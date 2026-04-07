import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { withWithdrawalColumnRetry } from "@/lib/withdrawal-ensure-column";
import { isActivatedMemberStatus } from "@/lib/user-status";
import {
  findWithdrawToUsdtTransactions,
  mergeWithdrawHistoryLists,
  sumWithdrawToUsdtInternal,
} from "@/lib/user-withdraw-history";

const REFERRAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export type UserDashboardPayload = {
  profile: {
    id: string;
    username: string;
    email: string;
    phone: string | null;
    walletAddress: string;
    referrerCode: string;
    balance: unknown;
    status: string;
    createdAt: Date;
    referredById: string | null;
    withdrawBalance: number;
    usdtBalance: number;
    permanentWithdrawAddress: string | null;
    securityCode: string | null;
    withdrawSuspendSource: string | null;
    /** ISO timestamp — activity window for 10-day team withdraw rule resets from this moment. */
    lastDownlineActivityAt: string | null;
  };
  directReferrals: number;
  currentLevel: number;
  recentTransactions: Array<Record<string, unknown>>;
  recentDeposits: Array<Record<string, unknown>>;
  /** Withdrawal records (pending / approved / rejected); user history is not stored as Transaction.type withdrawal. */
  recentWithdrawals: Array<Record<string, unknown>>;
  depositTotal: number;
  withdrawalTotal: number;
  /** All-time sum of MLM commission credits (not derived from the last N activity rows). */
  commissionTotal: number;
  /** Commission credited today (UTC calendar day; matches client date display). */
  commissionToday: number;
  referralGate: null | { state: "unverified" | "verified"; expiresAt: string; secondsLeft: number };
};

export async function getUserDashboardPayload(
  userId: string,
  options: { adminPreview?: boolean } = {},
): Promise<
  { success: true; data: UserDashboardPayload } | { success: false; status: number; error: string }
> {
  const db = getDb();
  const now = new Date();
  const nowMs = now.getTime();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      walletAddress: true,
      referrerCode: true,
      balance: true,
      status: true,
      createdAt: true,
      referredById: true,
      withdrawSuspendSource: true,
      lastDownlineActivityAt: true,
    },
  });

  if (!user) {
    return { success: false, status: 404, error: "User not found" };
  }

  let withdrawBalance = 0;
  let usdtBalance = 0;
  let permanentWithdrawAddress: string | null = null;

  try {
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT "withdrawBalance", "usdtBalance", "permanentWithdrawAddress" FROM "User" WHERE id = $1`,
      userId,
    );

    if (rows && rows.length > 0) {
      const row = rows[0];
      withdrawBalance = Number(row.withdrawBalance ?? row.withdrawbalance ?? 0);
      usdtBalance = Number(row.usdtBalance ?? row.usdtbalance ?? 0);
      permanentWithdrawAddress = row.permanentWithdrawAddress ?? row.permanentwithdrawaddress ?? null;
    }
  } catch {
    try {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT withdrawbalance, usdtbalance, permanentwithdrawaddress FROM "User" WHERE id = $1`,
        userId,
      );
      if (rows && rows.length > 0) {
        const row = rows[0];
        withdrawBalance = Number(row.withdrawbalance ?? 0);
        usdtBalance = Number(row.usdtbalance ?? 0);
        permanentWithdrawAddress = row.permanentwithdrawaddress ?? null;
      }
    } catch {
      try {
        const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM "User" WHERE id = $1`, userId);
        if (rows && rows[0]) {
          const r = rows[0];
          withdrawBalance = Number(r.withdrawBalance ?? r.withdrawbalance ?? 0);
          usdtBalance = Number(r.usdtBalance ?? r.usdtbalance ?? 0);
          permanentWithdrawAddress = r.permanentWithdrawAddress ?? r.permanentwithdrawaddress ?? null;
        }
      } catch {
        /* silent */
      }
    }
  }

  if (permanentWithdrawAddress === "") permanentWithdrawAddress = null;

  let hasSecurityCode = false;
  try {
    const u: any = await db.user.findUnique({
      where: { id: userId },
      select: { securityCode: true },
    });
    hasSecurityCode = !!u?.securityCode;
  } catch {
    try {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT "securityCode" FROM "User" WHERE id = $1`, userId);
      hasSecurityCode = !!rows[0]?.securityCode;
    } catch {
      /* silent */
    }
  }

  const maskedProfile = {
    ...user,
    withdrawBalance,
    usdtBalance,
    permanentWithdrawAddress,
    securityCode: hasSecurityCode ? "exists" : null,
    withdrawSuspendSource: user.withdrawSuspendSource ?? null,
    lastDownlineActivityAt: user.lastDownlineActivityAt
      ? user.lastDownlineActivityAt.toISOString()
      : null,
  };

  let referralGate: UserDashboardPayload["referralGate"] = null;
  if (user.referredById && user.status !== "admin") {
    const expiresAt = new Date(user.createdAt.getTime() + REFERRAL_WINDOW_MS);
    if (isActivatedMemberStatus(user.status)) {
      referralGate = { state: "verified", expiresAt: expiresAt.toISOString(), secondsLeft: 0 };
    } else if (nowMs > expiresAt.getTime()) {
      if (!options.adminPreview) {
        return {
          success: false,
          status: 403,
          error: "Account deactivated (Activation window expired)",
        };
      }
      referralGate = null;
    } else {
      referralGate = {
        state: "unverified",
        expiresAt: expiresAt.toISOString(),
        secondsLeft: Math.max(0, Math.floor((expiresAt.getTime() - nowMs) / 1000)),
      };
    }
  }

  const utcDayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const utcDayEnd = new Date(utcDayStart.getTime() + 86400000);

  const [referrals, transactions, depAgg, recentDeposits, commissionAllAgg, commissionTodayAgg] =
    await Promise.all([
      db.user.count({
        where: { referredById: userId, status: { in: ["active", "withdraw_suspend"] } },
      }),
      db.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.deposit.aggregate({ where: { userId, status: "confirmed" }, _sum: { amount: true } }),
      db.deposit.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.transaction.aggregate({
        where: { userId, type: "commission" },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: {
          userId,
          type: "commission",
          createdAt: { gte: utcDayStart, lt: utcDayEnd },
        },
        _sum: { amount: true },
      }),
    ]);

  const commissionTotal = Number(commissionAllAgg._sum.amount ?? 0);
  const commissionToday = Number(commissionTodayAgg._sum.amount ?? 0);

  let recentWithdrawalsRaw: Awaited<ReturnType<typeof db.withdrawal.findMany>> = [];
  let internalWithdrawToUsdt: Awaited<ReturnType<typeof findWithdrawToUsdtTransactions>> = [];
  try {
    const [wRows, intRows] = await Promise.all([
      withWithdrawalColumnRetry(db, () =>
        db.withdrawal.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 80,
        }),
      ),
      findWithdrawToUsdtTransactions(db, userId, 80),
    ]);
    recentWithdrawalsRaw = wRows;
    internalWithdrawToUsdt = intRows;
  } catch (err) {
    console.error("user-dashboard-data: withdrawal / internal history failed", err);
    recentWithdrawalsRaw = [];
    internalWithdrawToUsdt = [];
  }

  let currentLevel = 0;
  if (referrals >= 2) {
    currentLevel = Math.floor(Math.log2(referrals));
  }

  const depositTotal = Number(depAgg._sum.amount ?? 0);
  /** Gross requested for approved on-chain withdrawals + withdraw wallet → USDT internal transfers. */
  let withdrawalTotal = 0;
  try {
    const whSum = await db.$queryRaw<Array<{ v: unknown }>>(
      Prisma.sql`
        SELECT COALESCE(SUM(COALESCE("grossRequested", amount)), 0) AS v
        FROM "Withdrawal"
        WHERE "userId" = ${userId} AND status = 'approved'
      `,
    );
    withdrawalTotal = Number(whSum[0]?.v ?? 0);
  } catch {
    const wdAgg = await db.withdrawal.aggregate({
      where: { userId, status: "approved" },
      _sum: { amount: true },
    });
    withdrawalTotal = Number(wdAgg._sum.amount ?? 0);
  }
  try {
    withdrawalTotal += await sumWithdrawToUsdtInternal(db, userId);
  } catch {
    /* ignore */
  }

  const data: UserDashboardPayload = {
    profile: maskedProfile as UserDashboardPayload["profile"],
    directReferrals: referrals,
    currentLevel,
    recentTransactions: transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      createdAt: t.createdAt.toISOString(),
    })) as unknown as UserDashboardPayload["recentTransactions"],
    recentDeposits: recentDeposits.map((d) => ({
      ...d,
      amount: Number(d.amount),
      createdAt: d.createdAt.toISOString(),
    })) as unknown as UserDashboardPayload["recentDeposits"],
    recentWithdrawals: mergeWithdrawHistoryLists(
      recentWithdrawalsRaw,
      internalWithdrawToUsdt,
      50,
    ) as unknown as UserDashboardPayload["recentWithdrawals"],
    depositTotal,
    withdrawalTotal,
    commissionTotal,
    commissionToday,
    referralGate,
  };

  return { success: true, data };
}

import { getDb } from "@/lib/db";
import { withWithdrawalColumnRetry } from "@/lib/withdrawal-ensure-column";

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
  };
  directReferrals: number;
  currentLevel: number;
  recentTransactions: Array<Record<string, unknown>>;
  recentDeposits: Array<Record<string, unknown>>;
  /** Withdrawal records (pending / approved / rejected); user history is not stored as Transaction.type withdrawal. */
  recentWithdrawals: Array<Record<string, unknown>>;
  depositTotal: number;
  withdrawalTotal: number;
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
  };

  let referralGate: UserDashboardPayload["referralGate"] = null;
  if (user.referredById && user.status !== "admin") {
    const expiresAt = new Date(user.createdAt.getTime() + REFERRAL_WINDOW_MS);
    if (user.status === "active") {
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

  const [referrals, transactions, depAgg, wdAgg, recentDeposits] = await Promise.all([
    db.user.count({ where: { referredById: userId, status: "active" } }),
    db.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.deposit.aggregate({ where: { userId, status: "confirmed" }, _sum: { amount: true } }),
    db.withdrawal.aggregate({ where: { userId, status: "approved" }, _sum: { amount: true } }),
    db.deposit.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  let recentWithdrawals: Awaited<ReturnType<typeof db.withdrawal.findMany>> = [];
  try {
    recentWithdrawals = await withWithdrawalColumnRetry(db, () =>
      db.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  } catch (err) {
    console.error("user-dashboard-data: withdrawal.findMany failed", err);
    recentWithdrawals = [];
  }

  let currentLevel = 0;
  if (referrals >= 2) {
    currentLevel = Math.floor(Math.log2(referrals));
  }

  const depositTotal = Number(depAgg._sum.amount ?? 0);
  const withdrawalTotal = Number(wdAgg._sum.amount ?? 0);

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
    recentWithdrawals: recentWithdrawals.map((w) => ({
      id: w.id,
      address: w.address,
      amount: Number(w.amount),
      grossRequested: w.grossRequested != null ? Number(w.grossRequested) : null,
      feeAmount: w.feeAmount != null ? Number(w.feeAmount) : null,
      status: w.status,
      txHash: w.txHash,
      createdAt: w.createdAt.toISOString(),
    })) as unknown as UserDashboardPayload["recentWithdrawals"],
    depositTotal,
    withdrawalTotal,
    referralGate,
  };

  return { success: true, data };
}

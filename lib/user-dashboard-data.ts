import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { withWithdrawalColumnRetry } from "@/lib/withdrawal-ensure-column";
import { isActivatedMemberStatus } from "@/lib/user-status";
import {
  findWithdrawToUsdtTransactions,
  mergeWithdrawHistoryLists,
  sumWithdrawToUsdtInternal,
} from "@/lib/user-withdraw-history";
import {
  applyAutoWithdrawSuspendIfStaleForUser,
  secondsRemainingInTeamActivityWindow,
  TEAM_INACTIVITY_DAYS,
} from "@/lib/team-withdraw-activity";
import { computeBinaryLevelsCompleted } from "@/lib/binary-level-completed";
import { TREE_QUERY_MAX_DEPTH } from "@/lib/tree-display";

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
    /** ISO timestamp — team withdraw activity window resets from this moment. */
    lastDownlineActivityAt: string | null;
    /** Inactivity days before auto withdraw_suspend (server rule). */
    teamWithdrawInactivityDays: number;
    /** Countdown for active members; null if not applicable (e.g. admin). */
    secondsUntilTeamWithdrawAutoSuspend: number | null;
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

  await applyAutoWithdrawSuspendIfStaleForUser(db, userId);

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
      adminRoleId: true,
      withdrawSuspendSource: true,
      lastDownlineActivityAt: true,
      withdrawBalance: true,
      usdtBalance: true,
      permanentWithdrawAddress: true,
      securityCode: true,
    },
  });

  if (!user) {
    return { success: false, status: 404, error: "User not found" };
  }

  const withdrawBalance = Number(user.withdrawBalance ?? 0);
  const usdtBalance = Number(user.usdtBalance ?? 0);
  let permanentWithdrawAddress: string | null = user.permanentWithdrawAddress ?? null;
  if (permanentWithdrawAddress === "") permanentWithdrawAddress = null;

  const hasSecurityCode = !!user.securityCode;

  let secondsUntilTeamWithdrawAutoSuspend: number | null = null;
  if (
    user.status === "active" &&
    user.adminRoleId == null &&
    user.lastDownlineActivityAt
  ) {
    secondsUntilTeamWithdrawAutoSuspend = secondsRemainingInTeamActivityWindow(
      user.lastDownlineActivityAt,
      now,
    );
  }

  const { adminRoleId: _adminRoleId, ...userRest } = user;
  void _adminRoleId;

  const maskedProfile = {
    ...userRest,
    withdrawBalance,
    usdtBalance,
    permanentWithdrawAddress,
    securityCode: hasSecurityCode ? "exists" : null,
    withdrawSuspendSource: user.withdrawSuspendSource ?? null,
    lastDownlineActivityAt: user.lastDownlineActivityAt
      ? user.lastDownlineActivityAt.toISOString()
      : null,
    teamWithdrawInactivityDays: TEAM_INACTIVITY_DAYS,
    secondsUntilTeamWithdrawAutoSuspend,
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

  const approvedWithdrawalSum = async (): Promise<number> => {
    try {
      const whSum = await db.$queryRaw<Array<{ v: unknown }>>(
        Prisma.sql`
        SELECT COALESCE(SUM(COALESCE("grossRequested", amount)), 0) AS v
        FROM "Withdrawal"
        WHERE "userId" = ${userId} AND status = 'approved'
      `,
      );
      return Number(whSum[0]?.v ?? 0);
    } catch {
      const wdAgg = await db.withdrawal.aggregate({
        where: { userId, status: "approved" },
        _sum: { amount: true },
      });
      return Number(wdAgg._sum.amount ?? 0);
    }
  };

  const [
    referrals,
    transactions,
    depAgg,
    recentDeposits,
    commissionAllAgg,
    commissionTodayAgg,
    recentWithdrawalsRaw,
    internalWithdrawToUsdt,
    chainWithdrawalTotal,
    internalTransferTotal,
    downlineByDepthRows,
  ] = await Promise.all([
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
    withWithdrawalColumnRetry(db, () =>
      db.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
    ).catch((err) => {
      console.error("user-dashboard-data: withdrawal list failed", err);
      return [] as Awaited<ReturnType<typeof db.withdrawal.findMany>>;
    }),
    findWithdrawToUsdtTransactions(db, userId, 80).catch((err) => {
      console.error("user-dashboard-data: internal withdraw history failed", err);
      return [];
    }),
    approvedWithdrawalSum(),
    sumWithdrawToUsdtInternal(db, userId).catch(() => 0),
    db.$queryRaw<Array<{ level: number; count: bigint | number }>>(Prisma.sql`
      WITH RECURSIVE downline AS (
        SELECT id, "referredById", 1 AS depth
        FROM "User"
        WHERE "referredById" = ${userId} AND status <> 'inactive'
        UNION ALL
        SELECT u.id, u."referredById", d.depth + 1
        FROM "User" u
        JOIN downline d ON u."referredById" = d.id
        WHERE d.depth < ${TREE_QUERY_MAX_DEPTH} AND u.status <> 'inactive'
      )
      SELECT depth AS level, COUNT(*) AS count
      FROM downline
      GROUP BY depth
      ORDER BY depth ASC
    `),
  ]);

  const commissionTotal = Number(commissionAllAgg._sum.amount ?? 0);
  const commissionToday = Number(commissionTodayAgg._sum.amount ?? 0);

  const levelCounts: Record<string, number> = {};
  for (const r of downlineByDepthRows) {
    levelCounts[String(r.level)] = Number(r.count);
  }
  const currentLevel = computeBinaryLevelsCompleted(levelCounts);

  const depositTotal = Number(depAgg._sum.amount ?? 0);
  /** Gross requested for approved on-chain withdrawals + withdraw wallet → USDT internal transfers. */
  const withdrawalTotal = Number((chainWithdrawalTotal + internalTransferTotal).toFixed(2));

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

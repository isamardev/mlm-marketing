import type { Prisma } from "@prisma/client";
import type { getDb } from "@/lib/db";

/** How many upline ancestors get activity + optional auto-restore on each new registration. */
export const TEAM_UPLINE_STEPS = 10;
/**
 * Inactivity window before auto `withdraw_suspend` (team / downline activity).
 * TEMP: 10 minutes for testing — set back to 10 days when requested (use days in cutoff below).
 */
export const TEAM_INACTIVITY_MINUTES = 10;
/** Production value to restore: `10` days — replace minutes logic in `inactivityCutoff()` with `setDate`. */
export const TEAM_INACTIVITY_DAYS_PRODUCTION = 10;

export const AUTO_SUSPEND_SOURCE = "auto_team_inactivity" as const;
export const MANUAL_SUSPEND_SOURCE = "manual" as const;

function inactivityCutoff(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() - TEAM_INACTIVITY_MINUTES);
  return d;
}

type DbLike = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; referredById: true; status: true; withdrawSuspendSource: true };
    }) => Promise<{
      id: string;
      referredById: string | null;
      status: string;
      withdrawSuspendSource: string | null;
    } | null>;
    update: (args: { where: { id: string }; data: Prisma.UserUpdateInput }) => Promise<unknown>;
  };
};

/**
 * Call when a member activates (not on signup alone). Walks up to 10 sponsors: refreshes
 * `lastDownlineActivityAt` and restores `withdraw_suspend` only when `withdrawSuspendSource` was auto_team_inactivity.
 */
export async function onNewMemberRegistered(
  db: DbLike,
  newUserId: string,
): Promise<void> {
  const u = await db.user.findUnique({
    where: { id: newUserId },
    select: { id: true, referredById: true, status: true, withdrawSuspendSource: true },
  });
  if (!u || u.status === "admin") return;

  const now = new Date();
  let currentId: string | null = u.referredById;

  for (let depth = 0; depth < TEAM_UPLINE_STEPS && currentId; depth++) {
    const parent = await db.user.findUnique({
      where: { id: currentId },
      select: { id: true, referredById: true, status: true, withdrawSuspendSource: true },
    });
    if (!parent) break;

    const data: Prisma.UserUpdateInput = {
      lastDownlineActivityAt: now,
    };

    if (
      parent.status === "withdraw_suspend" &&
      parent.withdrawSuspendSource === AUTO_SUSPEND_SOURCE
    ) {
      data.status = "active";
      data.withdrawSuspendSource = null;
    }

    await db.user.update({ where: { id: parent.id }, data });
    currentId = parent.referredById;
  }
}

// Same inactivity rule as runTeamWithdrawAutoSuspendSweep, for one user (dashboard or withdraw routes).
export async function applyAutoWithdrawSuspendIfStaleForUser(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<void> {
  const cutoff = inactivityCutoff();
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { status: true, adminRoleId: true, lastDownlineActivityAt: true },
  });
  if (!u || u.status !== "active" || u.adminRoleId != null) return;
  if (u.lastDownlineActivityAt >= cutoff) return;
  await db.user.update({
    where: { id: userId },
    data: {
      status: "withdraw_suspend",
      withdrawSuspendSource: AUTO_SUSPEND_SOURCE,
    },
  });
}

/**
 * Runs stale check for this user and up to {@link TEAM_UPLINE_STEPS} sponsors above (same tree path).
 * Global downline sweep stays on cron / per-request for self only to avoid heavy queries.
 */
export async function applyAutoWithdrawSuspendIfStaleForUserAndUpline(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<void> {
  await applyAutoWithdrawSuspendIfStaleForUser(db, userId);
  let currentId: string | null = userId;
  for (let depth = 0; depth < TEAM_UPLINE_STEPS; depth++) {
    if (currentId == null) break;
    const row: { referredById: string | null } | null = await db.user.findUnique({
      where: { id: currentId },
      select: { referredById: true },
    });
    if (!row?.referredById) break;
    await applyAutoWithdrawSuspendIfStaleForUser(db, row.referredById);
    currentId = row.referredById;
  }
}

/**
 * Marks active members (non-admin) with stale team activity as auto withdraw-suspended.
 */
export async function runTeamWithdrawAutoSuspendSweep(db: ReturnType<typeof getDb>): Promise<{ updated: number }> {
  const cutoff = inactivityCutoff();

  const res = await db.user.updateMany({
    where: {
      status: "active",
      adminRoleId: null,
      lastDownlineActivityAt: { lt: cutoff },
    },
    data: {
      status: "withdraw_suspend",
      withdrawSuspendSource: AUTO_SUSPEND_SOURCE,
    },
  });

  return { updated: res.count };
}

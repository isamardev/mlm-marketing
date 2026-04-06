import type { Prisma } from "@prisma/client";
import type { getDb } from "@/lib/db";

/** How many upline ancestors get activity + optional auto-restore on each new registration. */
export const TEAM_UPLINE_STEPS = 10;
/** Inactivity window before auto withdraw_suspend (same calendar days). */
export const TEAM_INACTIVITY_DAYS = 10;

export const AUTO_SUSPEND_SOURCE = "auto_team_inactivity" as const;
export const MANUAL_SUSPEND_SOURCE = "manual" as const;

function inactivityCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - TEAM_INACTIVITY_DAYS);
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

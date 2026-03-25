import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const userId = session.user.id;

    const REFERRAL_WINDOW_MS = 24 * 60 * 60 * 1000;
    const now = new Date();
    const nowMs = now.getTime();

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        walletAddress: true,
        referrerCode: true,
        balance: true,
        status: true,
        createdAt: true,
        referredById: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let referralGate: null | { state: "unverified" | "verified"; expiresAt: string; secondsLeft: number } = null;
    if (user.referredById && user.status === "active") {
      const expiresAt = new Date(user.createdAt.getTime() + REFERRAL_WINDOW_MS);
      const verified = await db.deposit.findFirst({
        where: { userId, status: "confirmed", createdAt: { lte: expiresAt } },
        select: { id: true },
      });
      if (verified) {
        referralGate = { state: "verified", expiresAt: expiresAt.toISOString(), secondsLeft: 0 };
      } else if (nowMs > expiresAt.getTime()) {
        await db.user.update({ where: { id: userId }, data: { status: "inactive" } });
        return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
      } else {
        referralGate = {
          state: "unverified",
          expiresAt: expiresAt.toISOString(),
          secondsLeft: Math.max(0, Math.floor((expiresAt.getTime() - nowMs) / 1000)),
        };
      }
    }

    const direct = await db.user.findMany({
      where: { referredById: userId, status: { not: "inactive" } },
      select: { id: true, createdAt: true, status: true },
    });
    const deactivateIds: string[] = [];
    for (const child of direct) {
      if (child.status === "inactive") continue;
      const expiresAt = new Date(child.createdAt.getTime() + REFERRAL_WINDOW_MS);
      if (nowMs <= expiresAt.getTime()) continue;
      const verified = await db.deposit.findFirst({
        where: { userId: child.id, status: "confirmed", createdAt: { lte: expiresAt } },
        select: { id: true },
      });
      if (!verified) {
        deactivateIds.push(child.id);
      }
    }
    if (deactivateIds.length > 0) {
      await db.user.updateMany({ where: { id: { in: deactivateIds } }, data: { status: "inactive" } });
    }

    const [referrals, transactions, depAgg, wdAgg] = await Promise.all([
      db.user.count({ where: { referredById: userId, status: "active" } }),
      db.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.deposit.aggregate({ where: { userId, status: "confirmed" }, _sum: { amount: true } }),
      db.withdrawal.aggregate({ where: { userId, status: "approved" }, _sum: { amount: true } }),
    ]);

    const depositTotal = Number(depAgg._sum.amount ?? 0);
    const withdrawalTotal = Number(wdAgg._sum.amount ?? 0);

    return NextResponse.json({
      profile: user,
      directReferrals: referrals,
      recentTransactions: transactions,
      depositTotal,
      withdrawalTotal,
      referralGate,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

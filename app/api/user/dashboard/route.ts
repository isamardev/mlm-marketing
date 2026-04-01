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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Safely get withdrawBalance as well
    let withdrawBalance = 0;
    let usdtBalance = 0;
    try {
      // Use raw SQL directly to avoid Prisma client sync issues
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT "withdrawBalance", "usdtBalance" FROM "User" WHERE id = $1`,
        userId
      );
      withdrawBalance = Number(rows[0]?.withdrawBalance ?? 0);
      usdtBalance = Number(rows[0]?.usdtBalance ?? 0);
    } catch (e) {
      // If it doesn't exist, we might need to add the column or just use 0
      try {
        await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "withdrawBalance" DECIMAL(18,2) DEFAULT 0`);
        await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "usdtBalance" DECIMAL(18,2) DEFAULT 0`);
      } catch (alterErr) {
        // silent
      }
    }

    // Check for security code existence safely
    let hasSecurityCode = false;
    try {
      const u: any = await db.user.findUnique({
        where: { id: userId },
        select: { securityCode: true }
      });
      hasSecurityCode = !!u?.securityCode;
    } catch (e) {
      // Fallback to raw query if Prisma client is out of sync
      try {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT "securityCode" FROM "User" WHERE id = $1`,
          userId
        );
        hasSecurityCode = !!rows[0]?.securityCode;
      } catch (err) {
        console.error("Failed to check securityCode:", err);
      }
    }

    const maskedProfile = {
      ...user,
      withdrawBalance,
      usdtBalance,
      securityCode: hasSecurityCode ? "exists" : null,
    };

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

    const [referrals, transactions, depAgg, wdAgg, totalTeam] = await Promise.all([
      db.user.count({ where: { referredById: userId, status: "active" } }),
      db.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.deposit.aggregate({ where: { userId, status: "confirmed" }, _sum: { amount: true } }),
      db.withdrawal.aggregate({ where: { userId, status: "approved" }, _sum: { amount: true } }),
      db.user.count({ where: { referredById: userId, status: "active" } }), // We'll use this for level logic
    ]);

    // Calculate level based on full binary completion
    // Level 0: 0-1 referrals
    // Level 1: 2-3 referrals
    // Level 2: 4-7 referrals
    // Logic: Level N is complete when you have 2^(N) total nodes at that level or total direct?
    // User said: 2 complete -> Level 1. Level 2 needs 4 total.
    // This looks like Level = floor(log2(referrals))
    let currentLevel = 0;
    if (referrals >= 2) {
      currentLevel = Math.floor(Math.log2(referrals));
    }

    const depositTotal = Number(depAgg._sum.amount ?? 0);
    const withdrawalTotal = Number(wdAgg._sum.amount ?? 0);

    return NextResponse.json({
      profile: maskedProfile,
      directReferrals: referrals,
      currentLevel,
      recentTransactions: transactions,
      depositTotal,
      withdrawalTotal,
      referralGate,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

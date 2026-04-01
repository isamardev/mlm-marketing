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

    // Safely get withdrawBalance, usdtBalance, and permanentWithdrawAddress
    let withdrawBalance = 0;
    let usdtBalance = 0;
    let permanentWithdrawAddress = null;

    try {
      // Use double quotes for case-sensitive columns in Postgres
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT "withdrawBalance", "usdtBalance", "permanentWithdrawAddress" FROM "User" WHERE id = $1`,
        userId
      );
      
      if (rows && rows.length > 0) {
        const row = rows[0];
        withdrawBalance = Number(row.withdrawBalance ?? row.withdrawbalance ?? 0);
        usdtBalance = Number(row.usdtBalance ?? row.usdtbalance ?? 0);
        permanentWithdrawAddress = row.permanentWithdrawAddress ?? row.permanentwithdrawaddress ?? null;
      }
    } catch (e) {
      // If double quotes fail, try lowercase fallback
      try {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT withdrawbalance, usdtbalance, permanentwithdrawaddress FROM "User" WHERE id = $1`,
          userId
        );
        if (rows && rows.length > 0) {
          const row = rows[0];
          withdrawBalance = Number(row.withdrawbalance ?? 0);
          usdtBalance = Number(row.usdtbalance ?? 0);
          permanentWithdrawAddress = row.permanentwithdrawaddress ?? null;
        }
      } catch (inner) {
        // Last fallback: SELECT * to find whatever exists
        try {
          const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM "User" WHERE id = $1`, userId);
          if (rows && rows[0]) {
            const r = rows[0];
            withdrawBalance = Number(r.withdrawBalance ?? r.withdrawbalance ?? 0);
            usdtBalance = Number(r.usdtBalance ?? r.usdtbalance ?? 0);
            permanentWithdrawAddress = r.permanentWithdrawAddress ?? r.permanentwithdrawaddress ?? null;
          }
        } catch (final) { /* silent */ }
      }
    }

    // Ensure the permanentWithdrawAddress is handled correctly if it's empty string
    if (permanentWithdrawAddress === "") permanentWithdrawAddress = null;

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
      permanentWithdrawAddress,
      securityCode: hasSecurityCode ? "exists" : null,
    };

    let referralGate: null | { state: "unverified" | "verified"; expiresAt: string; secondsLeft: number } = null;
    if (user.referredById && user.status !== "admin") {
      const expiresAt = new Date(user.createdAt.getTime() + REFERRAL_WINDOW_MS);
      if (user.status === "active") {
        referralGate = { state: "verified", expiresAt: expiresAt.toISOString(), secondsLeft: 0 };
      } else if (nowMs > expiresAt.getTime()) {
        // Force deactivate if window passed
        return NextResponse.json({ error: "Account deactivated (Activation window expired)" }, { status: 403 });
      } else {
        referralGate = {
          state: "unverified",
          expiresAt: expiresAt.toISOString(),
          secondsLeft: Math.max(0, Math.floor((expiresAt.getTime() - nowMs) / 1000)),
        };
      }
    }

    // Auto-deactivate referred users of THIS user who haven't activated within 24h
    const direct = await db.user.findMany({
      where: { referredById: userId, status: "inactive" },
      select: { id: true, createdAt: true },
    });
    const deactivateIds: string[] = [];
    for (const child of direct) {
      const expiresAt = new Date(child.createdAt.getTime() + REFERRAL_WINDOW_MS);
      if (nowMs > expiresAt.getTime()) {
        // They should have activated by now. Since they are still inactive, they are "expired"
        // We don't necessarily need to change status to anything else if "inactive" already means unverified,
        // but we can track them. For now, we'll just filter them out of active referrals count below.
      }
    }

    const [referrals, transactions, depAgg, wdAgg, recentDeposits] = await Promise.all([
      db.user.count({ where: { referredById: userId, status: "active" } }),
      db.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.deposit.aggregate({ where: { userId, status: "confirmed" }, _sum: { amount: true } }),
      db.withdrawal.aggregate({ where: { userId, status: "approved" }, _sum: { amount: true } }),
      db.deposit.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

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
      recentTransactions: transactions.map(t => ({
        ...t,
        amount: Number(t.amount),
        createdAt: t.createdAt.toISOString()
      })),
      recentDeposits: recentDeposits.map(d => ({
        ...d,
        amount: Number(d.amount),
        createdAt: d.createdAt.toISOString()
      })),
      depositTotal,
      withdrawalTotal,
      referralGate,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

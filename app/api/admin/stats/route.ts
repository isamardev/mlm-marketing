import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();

export async function GET() {
  // Default structure to return in case of errors
  const defaultData = {
    totalUsers: 0,
    nonAdminCount: 0,
    totalDeposits: 0,
    systemBalance: 0,
    availableBalance: 0,
    todayEarning: 0,
    adminCommissionWallet: 0,
    allUserWallet: 0,
    debug: { error: "Initial state or global error" }
  };

  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Total Users
    let totalUsers = 0;
    try {
      totalUsers = await db.user.count();
    } catch (e) { console.error("Stats API: totalUsers count failed", e); }

    // 2. All Users Data (for manual summation)
    let allUsers: any[] = [];
    try {
      // Use raw SQL directly to avoid Prisma client sync issues with withdrawBalance
      allUsers = await db.$queryRawUnsafe<any[]>(`SELECT id, status, balance, "withdrawBalance", email FROM "User"`);
    } catch (e: any) {
      console.error("Stats API: raw query for users failed", e.message);
      // Maybe withdrawBalance is missing
      try {
        allUsers = await db.$queryRawUnsafe<any[]>(`SELECT id, status, balance, email FROM "User"`);
      } catch (err2: any) {
        console.error("Stats API: final fallback failed", err2.message);
      }
    }

    // 3. Deposits Sum
    let totalDeposits = 0;
    try {
      const depAgg = await db.transaction.aggregate({
        where: { type: "deposit" },
        _sum: { amount: true }
      });
      totalDeposits = Number(depAgg._sum.amount || 0);
    } catch (e: any) { console.error("Stats API: deposits aggregate failed", e.message); }

    // Process Users Data
    let nonAdminCount = 0;
    let totalBal = 0;
    let totalWithdraw = 0;
    let adminBalance = 0;
    let adminWithdraw = 0;
    const adminIds: string[] = [];

    for (const u of allUsers) {
      const is_admin = u.status === "admin" || u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      
      const b = Number(u.balance || 0);
      const w = Number(u.withdrawBalance || 0);

      if (is_admin) {
        adminBalance += b;
        adminWithdraw += w;
        adminIds.push(u.id);
      } else {
        nonAdminCount++;
        totalBal += b;
        totalWithdraw += w;
      }
    }

    // 4. Today's Earning (Admin commissions)
    let todayEarning = 0;
    try {
      if (adminIds.length > 0) {
        const todayAgg = await db.transaction.aggregate({
          where: {
            userId: { in: adminIds },
            type: "commission",
            createdAt: { gte: today },
          },
          _sum: { amount: true },
        });
        todayEarning = Number(todayAgg._sum.amount || 0);
      }
    } catch (e: any) { console.error("Stats API: today earnings failed", e.message); }

    const finalData = {
      totalUsers,
      nonAdminCount,
      totalDeposits,
      systemBalance: Number((totalBal + totalWithdraw + adminBalance + adminWithdraw).toFixed(2)),
      availableBalance: Number((adminBalance + adminWithdraw).toFixed(2)),
      todayEarning,
      adminCommissionWallet: Number((adminBalance + adminWithdraw).toFixed(2)),
      allUserWallet: Number((totalBal + totalWithdraw).toFixed(2)),
      debug: { totalBal, totalWithdraw, adminBalance, adminWithdraw, userCount: allUsers.length }
    };

    return NextResponse.json(finalData);
  } catch (error) {
    console.error("Stats API: Global Error", error);
    return NextResponse.json(defaultData); // Always return valid structure
  }
}

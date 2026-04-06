import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminSection } from "@/lib/admin-api-guard";
import { isActivatedMemberStatus } from "@/lib/user-status";

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
    allUserWithdraw: 0,
    platformFeePool: 0,
    charityTotal: 0,
    debug: { error: "Initial state or global error" }
  };

  try {
    const gate = await requireAdminSection("overview");
    if (!gate.ok) return gate.response;

    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1–2. All users (for balances split). "Total Users" card = non-admin activated members (`active` or `withdraw_suspend`, same as MLM "active member").
    let allUsers: any[] = [];
    try {
      allUsers = await db.$queryRawUnsafe<any[]>(
        `SELECT id, status, balance, COALESCE("withdrawBalance", 0) AS "withdrawBalance", COALESCE("usdtBalance", 0) AS "usdtBalance", email FROM "User"`,
      );
    } catch (e: any) {
      console.error("Stats API: raw query for users failed", e.message);
      try {
        allUsers = await db.$queryRawUnsafe<any[]>(
          `SELECT id, status, balance, COALESCE("withdrawBalance", 0) AS "withdrawBalance", email FROM "User"`,
        );
      } catch (err2: any) {
        console.error("Stats API: fallback user query failed", err2.message);
        try {
          allUsers = await db.$queryRawUnsafe<any[]>(`SELECT id, status, balance, email FROM "User"`);
        } catch (err3: any) {
          console.error("Stats API: final fallback failed", err3.message);
        }
      }
    }

    // 3. Total deposits — sum confirmed Deposit rows (matches user dashboard & on-chain records).
    // Transaction.type "deposit" can miss flows that only write to Deposit (e.g. some verify paths).
    let totalDeposits = 0;
    try {
      const depAgg = await db.deposit.aggregate({
        where: { status: "confirmed" },
        _sum: { amount: true },
      });
      totalDeposits = Number(depAgg._sum.amount ?? 0);
    } catch (e: any) {
      console.error("Stats API: deposit table aggregate failed", e.message);
    }

    // 3b. Total approved withdrawals (non-admin users) — matches per-user withdrawal totals
    let allUserWithdraw = 0;
    try {
      const wdAgg = await db.withdrawal.aggregate({
        where: {
          status: "approved",
          user: { status: { not: "admin" } },
        },
        _sum: { amount: true },
      });
      allUserWithdraw = Number(wdAgg._sum.amount ?? 0);
    } catch (e: any) {
      console.error("Stats API: withdrawal aggregate failed", e.message);
    }

    // 3c. Platform fee pool (90% of 10% withdrawal fee) & charity (10% of that fee) — not MLM admin commission
    let platformFeePool = 0;
    let charityTotal = 0;
    try {
      const fund = await db.platformFund.findUnique({ where: { id: "default" } });
      if (fund) {
        platformFeePool = Number(fund.feePoolTotal ?? 0);
        charityTotal = Number(fund.charityTotal ?? 0);
      }
    } catch (e: any) {
      console.error("Stats API: platform fund failed", e.message);
    }

    // Process Users Data (include usdtBalance in wallet totals)
    let nonAdminCount = 0;
    let activeNonAdminCount = 0;
    let totalBal = 0;
    let totalWithdraw = 0;
    let totalUsdt = 0;
    let adminBalance = 0;
    let adminWithdraw = 0;
    let adminUsdt = 0;
    const adminIds: string[] = [];

    for (const u of allUsers) {
      const is_admin = u.status === "admin" || u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

      const b = Number(u.balance || 0);
      const w = Number(u.withdrawBalance ?? u.withdrawbalance ?? 0);
      const usdt = Number(u.usdtBalance ?? u.usdtbalance ?? 0);

      if (is_admin) {
        adminBalance += b;
        adminWithdraw += w;
        adminUsdt += usdt;
        adminIds.push(u.id);
      } else {
        nonAdminCount++;
        if (isActivatedMemberStatus(u.status)) {
          activeNonAdminCount++;
        }
        totalBal += b;
        totalWithdraw += w;
        totalUsdt += usdt;
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

    const allUserWalletSum = totalBal + totalWithdraw + totalUsdt;
    const adminWalletSum = adminBalance + adminWithdraw + adminUsdt;

    const finalData = {
      totalUsers: activeNonAdminCount,
      nonAdminCount,
      totalDeposits,
      systemBalance: Number((allUserWalletSum + adminWalletSum).toFixed(2)),
      availableBalance: Number(adminWalletSum.toFixed(2)),
      todayEarning,
      adminCommissionWallet: Number(adminWalletSum.toFixed(2)),
      allUserWallet: Number(allUserWalletSum.toFixed(2)),
      allUserWithdraw: Number(allUserWithdraw.toFixed(2)),
      platformFeePool: Number(platformFeePool.toFixed(2)),
      charityTotal: Number(charityTotal.toFixed(2)),
      debug: {
        totalBal,
        totalWithdraw,
        totalUsdt,
        adminBalance,
        adminWithdraw,
        adminUsdt,
        userCount: allUsers.length,
        nonAdminCount,
        activeNonAdminCount,
      },
    };

    return NextResponse.json(finalData);
  } catch (error) {
    console.error("Stats API: Global Error", error);
    return NextResponse.json(defaultData); // Always return valid structure
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const db = getDb();
    const [users, p2pTransactions] = await Promise.all([
      db.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          country: true,
          balance: true,
          status: true,
          createdAt: true,
          referredById: true,
          securityCode: true,
          _count: { select: { referrals: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.transaction.findMany({
        where: { type: "commission" },
        select: { userId: true, amount: true },
      }),
    ]);

    // Try to get withdrawBalance for all these users via raw SQL safely
    const withdrawMap = new Map<string, number>();
    try {
      const rows = await db.$queryRawUnsafe<any[]>(`SELECT id, "withdrawBalance" FROM "User"`);
      for (const r of rows) {
        withdrawMap.set(r.id, Number(r.withdrawBalance ?? r.withdrawbalance ?? 0));
      }
    } catch (err) {
      console.error("Failed to fetch withdrawBalance via raw SQL in users API");
    }
    // Try to get usdtBalance and permanentWithdrawAddress for all these users via raw SQL safely
    const usdtMap = new Map<string, number>();
    const withdrawAddressMap = new Map<string, string>();
    try {
      const rows = await db.$queryRawUnsafe<any[]>(`SELECT id, "usdtBalance", "permanentWithdrawAddress" FROM "User"`);
      for (const r of rows) {
        usdtMap.set(r.id, Number(r.usdtBalance ?? r.usdtbalance ?? 0));
        withdrawAddressMap.set(r.id, r.permanentWithdrawAddress ?? r.permanentwithdrawaddress ?? "");
      }
    } catch {
      // Fallback if the combined query fails
      try {
        const rows = await db.$queryRawUnsafe<any[]>(`SELECT id, "usdtBalance" FROM "User"`);
        for (const r of rows) usdtMap.set(r.id, Number(r.usdtBalance ?? r.usdtbalance ?? 0));
      } catch {}
      try {
        const rows = await db.$queryRawUnsafe<any[]>(`SELECT id, "permanentWithdrawAddress" FROM "User"`);
        for (const r of rows) withdrawAddressMap.set(r.id, r.permanentWithdrawAddress ?? r.permanentwithdrawaddress ?? "");
      } catch {}
    }

    const downlineRows = await db.$queryRaw<Array<{ rootId: string; downlineCount: bigint | number }>>(Prisma.sql`
      WITH RECURSIVE downline AS (
        SELECT u.id AS "rootId", c.id AS "nodeId", 1 AS depth
        FROM "User" u
        JOIN "User" c ON c."referredById" = u.id
        UNION ALL
        SELECT d."rootId", c.id AS "nodeId", d.depth + 1
        FROM downline d
        JOIN "User" c ON c."referredById" = d."nodeId"
        WHERE d.depth < 33
      )
      SELECT "rootId", COUNT(*) AS "downlineCount"
      FROM downline
      GROUP BY "rootId"
    `);

    const downlineMap = new Map(downlineRows.map((row) => [row.rootId, Number(row.downlineCount ?? 0)]));

    const nowMs = Date.now();
    const expiredIds: string[] = [];

    const safe = users.map((user) => {
      const createdAtMs = user.createdAt.getTime();
      const expiresAtMs = createdAtMs + 24 * 60 * 60 * 1000;
      
      const isActivated = user.status === "active" || user.status === "admin";

      let verifyStatus: string | null = null;
      let secondsLeft = 0;

      if (user.referredById && user.status !== "admin") {
        if (isActivated) {
          verifyStatus = "verified";
        } else if (nowMs < expiresAtMs) {
          verifyStatus = "unverified";
          secondsLeft = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
        } else {
          verifyStatus = "expired";
          expiredIds.push(user.id);
        }
      }

      return {
        ...user,
        balance: Number(user.balance ?? 0),
        withdrawBalance: withdrawMap.get(user.id) ?? 0,
        usdtBalance: usdtMap.get(user.id) ?? 0,
        permanentWithdrawAddress: withdrawAddressMap.get(user.id) ?? "",
        createdAt: user.createdAt.toISOString(),
        downlineCount: downlineMap.get(user.id) ?? 0,
        verifyStatus,
        secondsLeft,
      };
    });

    // Cleanup: Delete expired users from database as requested
    if (expiredIds.length > 0) {
      try {
        await db.$transaction([
          db.notification.deleteMany({ where: { userId: { in: expiredIds } } }),
          db.otp.deleteMany({ where: { userId: { in: expiredIds } } }),
          db.supportTicket.deleteMany({ where: { userId: { in: expiredIds } } }),
          db.transaction.deleteMany({ where: { OR: [{ userId: { in: expiredIds } }, { sourceUserId: { in: expiredIds } }] } }),
          db.deposit.deleteMany({ where: { userId: { in: expiredIds } } }),
          db.withdrawal.deleteMany({ where: { userId: { in: expiredIds } } }),
          db.user.deleteMany({ where: { id: { in: expiredIds } } }),
        ]);
        console.log(`Cleaned up ${expiredIds.length} expired users`);
      } catch (err) {
        console.error("Failed to cleanup expired users:", err);
      }
    }

    // Filter out expired users from the response list
    const filteredSafe = safe.filter(u => u.verifyStatus !== "expired");

    return NextResponse.json({ users: filteredSafe });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

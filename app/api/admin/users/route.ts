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
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        walletAddress: true,
        referrerCode: true,
        referredById: true,
        balance: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const downlineRows = await db.$queryRaw<Array<{ rootId: string; downlineCount: bigint | number }>>(Prisma.sql`
      WITH RECURSIVE downline AS (
        SELECT u.id AS rootId, c.id AS nodeId, 1 AS depth
        FROM \`User\` u
        JOIN \`User\` c ON c.referredById = u.id
        UNION ALL
        SELECT d.rootId, c.id AS nodeId, d.depth + 1
        FROM downline d
        JOIN \`User\` c ON c.referredById = d.nodeId
        WHERE d.depth < 20
      )
      SELECT rootId, COUNT(*) AS downlineCount
      FROM downline
      GROUP BY rootId
    `);

    const ids = users.map((user) => user.id);
    const deposits = ids.length
      ? await db.deposit.findMany({
          where: {
            userId: { in: ids },
            status: "confirmed",
          },
          select: {
            userId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const downlineMap = new Map(downlineRows.map((row) => [row.rootId, Number(row.downlineCount ?? 0)]));
    const depositsByUser = new Map<string, Date[]>();
    for (const deposit of deposits) {
      const list = depositsByUser.get(deposit.userId) ?? [];
      list.push(deposit.createdAt);
      depositsByUser.set(deposit.userId, list);
    }

    const nowMs = Date.now();
    const safe = users.map((user) => {
      const createdAtMs = user.createdAt.getTime();
      const expiresAtMs = createdAtMs + 24 * 60 * 60 * 1000;
      const userDeposits = depositsByUser.get(user.id) ?? [];
      const verified = user.referredById
        ? userDeposits.some((createdAt) => createdAt.getTime() <= expiresAtMs)
        : false;

      let verifyStatus: string | null = null;
      let secondsLeft = 0;

      if (user.referredById) {
        if (verified) {
          verifyStatus = "verified";
        } else if (nowMs < expiresAtMs) {
          verifyStatus = "unverified";
          secondsLeft = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
        } else {
          verifyStatus = "expired";
        }
      }

      return {
        ...user,
        balance: Number(user.balance ?? 0),
        createdAt: user.createdAt.toISOString(),
        downlineCount: downlineMap.get(user.id) ?? 0,
        verifyStatus,
        secondsLeft,
      };
    });

    return NextResponse.json({ users: safe });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_WALLET_ADDRESS } from "@/lib/admin";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const addr = (url.searchParams.get("address") || "").toLowerCase();
    if (!addr || addr !== ADMIN_WALLET_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const db = getDb();

    const users = await db.$queryRaw<
      Array<{
        id: string;
        username: string;
        email: string;
        walletAddress: string;
        referrerCode: string;
        referredById: string | null;
        balance: unknown;
        status: string;
        createdAt: Date;
        downlineCount: bigint | number;
      }>
    >(Prisma.sql`
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
      SELECT 
        u.id, u.username, u.email, u.walletAddress, u.referrerCode, u.referredById, u.balance, u.status, u.createdAt,
        COALESCE(cnt.downlineCount, 0) AS downlineCount
      FROM \`User\` u
      LEFT JOIN (
        SELECT rootId, COUNT(*) AS downlineCount
        FROM downline
        GROUP BY rootId
      ) cnt ON cnt.rootId = u.id
      ORDER BY u.createdAt DESC
    `);

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

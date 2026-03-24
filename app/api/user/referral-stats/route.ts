import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const userId = session.user.id;

    const rows = await db.$queryRaw<Array<{ level: number; count: bigint | number }>>(Prisma.sql`
      WITH RECURSIVE downline AS (
        SELECT id, referredById, 1 AS depth
        FROM \`User\`
        WHERE referredById = ${userId}
        UNION ALL
        SELECT u.id, u.referredById, d.depth + 1
        FROM \`User\` u
        JOIN downline d ON u.referredById = d.id
        WHERE d.depth < 20
      )
      SELECT depth AS level, COUNT(*) AS count
      FROM downline
      GROUP BY depth
      ORDER BY depth ASC
    `);

    const levels: Record<string, number> = {};
    for (const r of rows) {
      levels[String(r.level)] = Number(r.count);
    }

    let total = 0;
    for (const v of Object.values(levels)) total += v;

    return NextResponse.json({ total, levels });
  } catch {
    return NextResponse.json({ error: "Failed to fetch referral stats" }, { status: 500 });
  }
}


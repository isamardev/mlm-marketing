import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

const COMPANY_ADMIN_EMAIL = "admin@example.com";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.status === "inactive") {
      return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
    }
    if (session.user.status === "blocked") {
      return NextResponse.json({ error: "Account blocked" }, { status: 403 });
    }

    const db = getDb();
    const userId = session.user.id;

    const me = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, walletAddress: true, referrerCode: true, referredById: true, status: true },
    });
    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const companyAdmin = await db.user.findUnique({
      where: { email: COMPANY_ADMIN_EMAIL },
      select: { id: true, username: true, email: true, walletAddress: true, referrerCode: true, referredById: true, status: true },
    });

    const descendants = await db.$queryRaw<
      Array<{
        id: string;
        username: string;
        email: string;
        walletAddress: string;
        referrerCode: string;
        referredById: string | null;
        createdAt: Date;
        depth: number;
        verified: number;
      }>
    >(Prisma.sql`
      WITH RECURSIVE team AS (
        SELECT id, username, email, "walletAddress", "referrerCode", "referredById", "createdAt", 0 AS depth
        FROM "User"
        WHERE id = ${userId}
        UNION ALL
        SELECT u.id, u.username, u.email, u."walletAddress", u."referrerCode", u."referredById", u."createdAt", t.depth + 1 AS depth
        FROM "User" u
        JOIN team t ON u."referredById" = t.id
        WHERE t.depth < 19
      ),
      first_deposits AS (
        SELECT "userId", MIN("createdAt") AS "firstDepositAt"
        FROM "Deposit"
        WHERE status = 'confirmed'
        GROUP BY "userId"
      )
      SELECT
        t.id, t.username, t.email, t."walletAddress", t."referrerCode", t."referredById", t."createdAt", t.depth,
        CASE
          WHEN fd."firstDepositAt" IS NOT NULL AND fd."firstDepositAt" <= t."createdAt" + interval '24 hours' THEN 1
          ELSE 0
        END AS verified
      FROM team t
      LEFT JOIN first_deposits fd ON fd."userId" = t.id
      ORDER BY t.depth ASC
    `);

    if (!companyAdmin) {
      const nodes = descendants.map((n) => ({ ...n, verified: Number(n.verified) === 1 }));
      return NextResponse.json({ nodes });
    }
    const parentIsCompanyAdmin = !!me.referredById && me.referredById === companyAdmin.id;
    if (userId === companyAdmin.id || me.status === "admin") {
      const nodes = descendants.map((n) => ({ ...n, verified: Number(n.verified) === 1 }));
      return NextResponse.json({ nodes });
    }
    if (parentIsCompanyAdmin) {
      const nodes = [
        { ...companyAdmin, depth: 0, verified: true },
        ...descendants.map((n) => ({ ...n, depth: Number(n.depth) + 1, verified: Number(n.verified) === 1 })),
      ];
      return NextResponse.json({ nodes });
    }
    return NextResponse.json({ nodes: descendants.map((n) => ({ ...n, verified: Number(n.verified) === 1 })) });
  } catch {
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
}

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
    // No hard failure if admin row missing — show user's own descendants

    const descendants = await db.$queryRaw<
      Array<{
        id: string;
        username: string;
        email: string;
        walletAddress: string;
        referrerCode: string;
        referredById: string | null;
        depth: number;
      }>
    >(Prisma.sql`
      WITH RECURSIVE team AS (
        SELECT id, username, email, walletAddress, referrerCode, referredById, 0 AS depth
        FROM \`User\`
        WHERE id = ${userId}
        UNION ALL
        SELECT u.id, u.username, u.email, u.walletAddress, u.referrerCode, u.referredById, t.depth + 1 AS depth
        FROM \`User\` u
        JOIN team t ON u.referredById = t.id
        WHERE t.depth < 19
      )
      SELECT * FROM team ORDER BY depth ASC
    `);

    if (!companyAdmin) {
      return NextResponse.json({ nodes: descendants });
    }
    const parentIsCompanyAdmin = !!me.referredById && me.referredById === companyAdmin.id;
    if (userId === companyAdmin.id || me.status === "admin") {
      return NextResponse.json({ nodes: descendants });
    }
    if (parentIsCompanyAdmin) {
      const nodes = [
        { ...companyAdmin, depth: 0 },
        ...descendants.map((n) => ({ ...n, depth: Number(n.depth) + 1 })),
      ];
      return NextResponse.json({ nodes });
    }
    return NextResponse.json({ nodes: descendants });
  } catch {
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
}

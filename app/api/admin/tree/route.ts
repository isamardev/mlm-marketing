import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminSection } from "@/lib/admin-api-guard";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TREE_QUERY_MAX_DEPTH } from "@/lib/tree-display";

const DEFAULT_ADMIN_EMAIL = "admin@example.com";
const COMPANY_REF_CODE = "ADMIN111";

function companyAdminEmail() {
  return (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

export async function GET() {
  try {
    const gate = await requireAdminSection("overview");
    if (!gate.ok) return gate.response;

    const db = getDb();
    const rootEmail = companyAdminEmail();

    let admin = await db.user.findUnique({
      where: { email: rootEmail },
      select: { id: true },
    });
    if (!admin) {
      const passwordHash = await bcrypt.hash("admin123", 12);
      const walletPlaceholder = `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const created = await db.user.create({
        data: {
          username: "Admin",
          country: "Pakistan",
          email: rootEmail,
          passwordHash,
          walletAddress: walletPlaceholder,
          referrerCode: COMPANY_REF_CODE,
          referredById: null,
          balance: 0,
          status: "admin",
        },
        select: { id: true },
      });
      admin = created;
    }

    const rows = await db.$queryRaw<
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
        SELECT id, username, email, "walletAddress", "referrerCode", "referredById", 0 AS depth
        FROM "User"
        WHERE id = ${admin.id}
        UNION ALL
        SELECT u.id, u.username, u.email, u."walletAddress", u."referrerCode", u."referredById", t.depth + 1 AS depth
        FROM "User" u
        JOIN team t ON u."referredById" = t.id
        WHERE t.depth < ${TREE_QUERY_MAX_DEPTH}
      )
      SELECT * FROM team ORDER BY depth ASC
    `);

    const nodes = rows.map((r) => ({
      ...r,
      depth: Number(r.depth),
    }));

    return NextResponse.json({ nodes });
  } catch {
    return NextResponse.json({ error: "Failed to fetch admin tree" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const COMPANY_ADMIN_EMAIL = "admin@example.com";
const COMPANY_REF_CODE = "ADMIN111";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const db = getDb();

    let admin = await db.user.findUnique({
      where: { email: COMPANY_ADMIN_EMAIL },
      select: { id: true },
    });
    if (!admin) {
      const passwordHash = await bcrypt.hash("admin123", 12);
      const walletPlaceholder = `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const created = await db.user.create({
        data: {
          username: "Admin",
          country: "Pakistan",
          email: COMPANY_ADMIN_EMAIL,
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
        WHERE t.depth < 20
      )
      SELECT * FROM team ORDER BY depth ASC
    `);

    return NextResponse.json({ nodes: rows });
  } catch {
    return NextResponse.json({ error: "Failed to fetch admin tree" }, { status: 500 });
  }
}

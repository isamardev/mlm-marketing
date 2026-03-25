import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

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

    const [me, companyAdmin] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, walletAddress: true, referrerCode: true, referredById: true, status: true },
      }),
      db.user.findUnique({
        where: { email: COMPANY_ADMIN_EMAIL },
        select: { id: true, username: true, email: true, walletAddress: true, referrerCode: true, referredById: true, status: true },
      }),
    ]);

    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    // If company admin missing, fallback to best-effort upline without failing

    if (companyAdmin && (me.id === companyAdmin.id || me.status === "admin")) {
      return NextResponse.json({ nodes: [{ ...me, depth: 0 }] });
    }

    if (companyAdmin) {
      return NextResponse.json({ nodes: [{ ...companyAdmin, depth: 0 }, { ...me, depth: 1 }] });
    }
    // Fallback: include direct parent if present, else just self
    if (me.referredById) {
      const parent = await db.user.findUnique({
        where: { id: me.referredById },
        select: { id: true, username: true, email: true, walletAddress: true, referrerCode: true, referredById: true, status: true },
      });
      if (parent) {
        return NextResponse.json({ nodes: [{ ...parent, depth: 0 }, { ...me, depth: 1 }] });
      }
    }
    return NextResponse.json({ nodes: [{ ...me, depth: 0 }] });
  } catch {
    return NextResponse.json({ error: "Failed to fetch upline" }, { status: 500 });
  }
}

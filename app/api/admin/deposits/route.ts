import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const valid = ["pending", "confirmed", "rejected"];
    const filter = valid.includes(status) ? status : undefined;
    const db = getDb();
    const items = await db.deposit.findMany({
      where: filter ? { status: filter as any } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, username: true, email: true, walletAddress: true } } },
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Failed to fetch deposits" }, { status: 500 });
  }
}


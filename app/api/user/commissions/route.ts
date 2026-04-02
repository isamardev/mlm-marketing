import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserApiContext } from "@/lib/user-api-auth";

// GET /api/user/commissions
export async function GET(req: Request) {
  try {
    const ctx = await getUserApiContext(req);
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const db = getDb();
    const commissions = await db.transaction.findMany({
      where: {
        userId: ctx.userId,
        type: "commission",
      },
      include: {
        sourceUser: {
          select: {
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    const items = commissions.map((c) => ({
      id: c.id,
      fromUser: c.sourceUser?.username || "Unknown",
      fromEmail: c.sourceUser?.email || "Unknown",
      level: c.level,
      amount: c.amount,
      date: c.createdAt,
      note: c.note,
    }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Commission fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch commissions" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "../../../../auth"; // Use relative path to avoid Turbopack alias issues
import { getDb } from "@/lib/db";

// GET /api/user/commissions
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const commissions = await db.transaction.findMany({
      where: {
        userId: session.user.id,
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

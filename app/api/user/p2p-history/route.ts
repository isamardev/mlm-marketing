import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

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

    const items = await db.transaction.findMany({
      where: {
        userId,
        type: "adjustment",
        note: { startsWith: "P2P " },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const mapped = items.map((t) => {
      const amt = Number(t.amount);
      const dir = amt < 0 ? "sent" : "received";
      let counterparty = "";
      const mTo = /^P2P to (.+) \(([a-z0-9]+)\)/i.exec(t.note || "");
      const mFrom = /^P2P from (.+) \(([a-z0-9]+)\)/i.exec(t.note || "");
      if (mTo) counterparty = `${mTo[1]} (${mTo[2]})`;
      if (mFrom) counterparty = `${mFrom[1]} (${mFrom[2]})`;
      return {
        id: t.id,
        direction: dir,
        amount: Math.abs(amt),
        counterparty,
        createdAt: t.createdAt,
        note: t.note,
      };
    });

    return NextResponse.json({ items: mapped });
  } catch {
    return NextResponse.json({ error: "Failed to fetch P2P history" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserApiContext } from "@/lib/user-api-auth";

export async function GET(req: Request) {
  try {
    const ctx = await getUserApiContext(req);
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    if (ctx.effectiveStatus === "inactive") {
      return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
    }
    if (ctx.effectiveStatus === "blocked") {
      return NextResponse.json({ error: "Account blocked" }, { status: 403 });
    }

    const db = getDb();
    const userId = ctx.userId;

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

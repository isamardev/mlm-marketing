import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") ?? 50)));

    const db = getDb();
    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take,
      }),
      db.notification.count({
        where: { userId: session.user.id, readAt: null },
      }),
    ]);

    return NextResponse.json({ unread, items });
  } catch {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}


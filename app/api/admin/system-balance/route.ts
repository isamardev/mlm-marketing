import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const db = getDb();

    const depAgg = await db.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "deposit" },
    });
    const comAgg = await db.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "commission" },
    });

    const sumDeposits = Number(depAgg._sum.amount ?? 0);
    const sumCommissions = Number(comAgg._sum.amount ?? 0);
    const systemBalance = Number((sumDeposits - sumCommissions).toFixed(2));

    return NextResponse.json({ systemBalance, sumDeposits, sumCommissions });
  } catch {
    return NextResponse.json({ error: "Failed to compute system balance" }, { status: 500 });
  }
}

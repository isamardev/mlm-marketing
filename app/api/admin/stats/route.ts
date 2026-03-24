import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const db = getDb();

    const [totalUsers, depositsAgg, commissionsAgg] = await Promise.all([
      db.user.count(),
      db.transaction.aggregate({ where: { type: "deposit" }, _sum: { amount: true } }),
      db.transaction.aggregate({ where: { type: "commission" }, _sum: { amount: true } }),
    ]);

    const totalDeposits = Number(depositsAgg._sum.amount ?? 0);
    const totalCommissions = Number(commissionsAgg._sum.amount ?? 0);
    const systemBalance = Number((totalDeposits - totalCommissions).toFixed(2));

    return NextResponse.json({
      totalUsers,
      totalDeposits,
      systemBalance,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

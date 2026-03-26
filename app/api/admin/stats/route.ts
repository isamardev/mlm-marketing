import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

const ADMIN_EMAIL = "admin@example.com";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, depositsAgg, balanceAgg, adminUser] = await Promise.all([
      db.user.count(),
      db.transaction.aggregate({ where: { type: "deposit" }, _sum: { amount: true } }),
      db.user.aggregate({ _sum: { balance: true } }),
      db.user.findFirst({
        where: {
          OR: [{ status: "admin" }, { email: ADMIN_EMAIL }],
        },
        select: { id: true, balance: true },
      }),
    ]);

    const totalDeposits = Number(depositsAgg._sum.amount ?? 0);
    const systemBalance = Number(balanceAgg._sum.balance ?? 0);
    const availableBalance = Number(adminUser?.balance ?? 0);

    const todayAgg = adminUser
      ? await db.transaction.aggregate({
          where: {
            userId: adminUser.id,
            type: "commission",
            createdAt: { gte: today },
          },
          _sum: { amount: true },
        })
      : null;

    const todayEarning = Number(todayAgg?._sum.amount ?? 0);

    return NextResponse.json({
      totalUsers,
      totalDeposits,
      systemBalance,
      availableBalance,
      todayEarning,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const userId = session.user.id;

    const [user, referrals, transactions] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, walletAddress: true, referrerCode: true, balance: true, status: true },
      }),
      db.user.count({ where: { referredById: userId } }),
      db.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      profile: user,
      directReferrals: referrals,
      recentTransactions: transactions,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

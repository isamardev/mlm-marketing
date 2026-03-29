import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount, securityCode, target } = await req.json();
    const userId = session.user.id;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!securityCode) {
      return NextResponse.json({ error: "Security Code is required" }, { status: 400 });
    }

    const db = getDb();

    // 1. Get user and verify security code
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, balance: true, securityCode: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.securityCode !== securityCode.trim()) {
      return NextResponse.json({ error: "Invalid Security Code" }, { status: 401 });
    }

    if (Number(user.balance) < amount) {
      return NextResponse.json({ error: "Insufficient balance in main wallet" }, { status: 400 });
    }

    const targetField = target === "usdt" ? "usdtBalance" : "withdrawBalance";
    const targetLabel = target === "usdt" ? "USDT wallet" : "withdraw wallet";

    // 2. Perform transfer using transaction
    try {
      await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: {
            balance: { decrement: amount },
            [targetField]: { increment: amount }
          }
        }),
        db.transaction.create({
          data: {
            userId: userId,
            sourceUserId: userId,
            level: 0,
            amount: amount,
            type: "adjustment",
            note: `Internal transfer to ${targetLabel}`
          }
        })
      ]);
    } catch (e: any) {
      // Fallback for balance fields if Prisma client out of sync
      console.error("Prisma transaction failed, trying raw SQL:", e.message);
      await db.$executeRawUnsafe(
        `UPDATE "User" SET balance = balance - $1, "${targetField}" = "${targetField}" + $2 WHERE id = $3`,
        amount, amount, userId
      );
      await db.transaction.create({
        data: {
          userId: userId,
          sourceUserId: userId,
          level: 0,
          amount: amount,
          type: "adjustment",
          note: `Internal transfer to ${targetLabel} (raw)`
        }
      });
    }

    return NextResponse.json({ success: true, message: "Transfer successful" });
  } catch (error) {
    console.error("Internal transfer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

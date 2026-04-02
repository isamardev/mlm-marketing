import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runActivationPayoutEngine } from "@/lib/mlm-logic";
import { getUserApiContext } from "@/lib/user-api-auth";
import { getUserMainAndUsdtBalance } from "@/lib/user-balances";

export async function POST(req: Request) {
  try {
    const ctx = await getUserApiContext(req);
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    if (ctx.effectiveStatus === "blocked") {
      return NextResponse.json({ error: "Account blocked" }, { status: 403 });
    }

    const db = getDb();
    const userId = ctx.userId;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { status: true, referredById: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.status === "active" || user.status === "admin") {
      return NextResponse.json({ error: "Account is already active" }, { status: 400 });
    }

    // Check 24h window for referred users
    const REFERRAL_WINDOW_MS = 24 * 60 * 60 * 1000;
    if (user.referredById) {
      const expiresAt = new Date(user.createdAt.getTime() + REFERRAL_WINDOW_MS);
      if (Date.now() > expiresAt.getTime()) {
        return NextResponse.json({ error: "Activation period expired (24h limit reached)" }, { status: 403 });
      }
    }

    const { main, usdt } = await getUserMainAndUsdtBalance(db, userId);
    const totalAvailable = Number((main + usdt).toFixed(2));
    if (totalAvailable < 10) {
      return NextResponse.json({ error: "Insufficient balance. Need at least $10 across Main balance and USDT wallet." }, { status: 400 });
    }

    const result = await runActivationPayoutEngine({
      sourceUserId: userId,
      activationAmount: 10,
      note: "Account activation fee",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

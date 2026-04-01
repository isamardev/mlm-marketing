import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { runActivationPayoutEngine } from "@/lib/mlm-logic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const userId = session.user.id;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { status: true, balance: true },
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

    if (Number(user.balance) < 10) {
      return NextResponse.json({ error: "Insufficient balance. Please deposit at least $10." }, { status: 400 });
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

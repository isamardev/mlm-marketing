import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserApiContext } from "@/lib/user-api-auth";
import { withWithdrawalColumnRetry } from "@/lib/withdrawal-ensure-column";

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

    const rows = await withWithdrawalColumnRetry(db, () =>
      db.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );

    const items = rows.map((w) => ({
      id: w.id,
      address: w.address,
      amount: Number(w.amount),
      grossRequested: w.grossRequested != null ? Number(w.grossRequested) : null,
      feeAmount: w.feeAmount != null ? Number(w.feeAmount) : null,
      status: w.status,
      txHash: w.txHash,
      createdAt: w.createdAt.toISOString(),
    }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/user/withdrawals", e);
    return NextResponse.json({ error: "Failed to load withdrawals" }, { status: 500 });
  }
}

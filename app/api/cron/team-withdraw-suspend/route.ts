import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runTeamWithdrawAutoSuspendSweep } from "@/lib/team-withdraw-activity";

/**
 * Daily (or periodic) job: suspend withdrawals for active members with no new downline
 * activity in the last 10 days (10 upline levels refresh on each new registration).
 * Set CRON_SECRET in .env and call: GET /api/cron/team-withdraw-suspend with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getDb();
    const { updated } = await runTeamWithdrawAutoSuspendSweep(db);
    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

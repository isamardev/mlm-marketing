import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runTeamWithdrawAutoSuspendSweep } from "@/lib/team-withdraw-activity";

/**
 * Periodic job (see vercel.json): suspend active members with stale team activity
 * (see TEAM_INACTIVITY_MINUTES in lib/team-withdraw-activity.ts).
 * Vercel: set CRON_SECRET in project env — cron requests send Authorization: Bearer <CRON_SECRET>.
 * Manual: GET /api/cron/team-withdraw-suspend with the same header.
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

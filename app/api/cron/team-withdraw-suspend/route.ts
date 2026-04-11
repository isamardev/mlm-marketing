import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runTeamWithdrawAutoSuspendSweep } from "@/lib/team-withdraw-activity";

/**
 * Daily (or periodic) job: suspend withdrawals for active members with no new downline
 * activity in the last 10 minutes (temp; restore to 10 days in lib/team-withdraw-activity.ts when requested).
 * Set CRON_SECRET in .env and call: GET /api/cron/team-withdraw-suspend with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  /** Vercel Cron sets this header — required for `*/10 * * * *` schedules (Bearer optional on Vercel). */
  const vercelCronOk = process.env.VERCEL === "1" && req.headers.get("x-vercel-cron") === "1";
  if (!authOk && !vercelCronOk) {
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

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runTeamWithdrawAutoSuspendSweep } from "@/lib/team-withdraw-activity";

// GET /api/cron/team-withdraw-suspend - sweep users with stale team activity (see lib/team-withdraw-activity.ts).
// Auth: Authorization: Bearer CRON_SECRET, or Vercel Cron (header x-vercel-cron on Vercel deployments).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearerOk =
    Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  const vercelCronOk =
    process.env.VERCEL === "1" && req.headers.get("x-vercel-cron") === "1";
  if (!bearerOk && !vercelCronOk) {
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

import { NextResponse } from "next/server";
import { getUserDashboardPayload } from "@/lib/user-dashboard-data";
import { getUserApiContext } from "@/lib/user-api-auth";

export async function GET(req: Request) {
  try {
    const ctx = await getUserApiContext(req);
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const result = await getUserDashboardPayload(ctx.userId, {
      adminPreview: ctx.impersonation,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

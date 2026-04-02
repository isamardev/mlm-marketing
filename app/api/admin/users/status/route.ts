import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireAdminSection } from "@/lib/admin-api-guard";

const schema = z.object({
  id: z.string().min(6),
  status: z.enum(["active", "inactive", "blocked"]),
});

export async function PATCH(req: Request) {
  try {
    const gate = await requireAdminSection("users");
    if (!gate.ok) return gate.response;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = getDb();
    const target = await db.user.findUnique({ where: { id: parsed.data.id }, select: { id: true, status: true } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.status === "admin") {
      return NextResponse.json({ error: "Cannot change admin status" }, { status: 400 });
    }
    const updated = await db.user.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
      select: { id: true, status: true },
    });
    return NextResponse.json({ success: true, user: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
  }
}


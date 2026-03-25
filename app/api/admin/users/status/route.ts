import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  id: z.string().min(6),
  status: z.enum(["active", "inactive", "blocked"]),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
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


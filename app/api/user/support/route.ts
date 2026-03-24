import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  subject: z.string().min(3).max(120),
  message: z.string().min(10).max(2000),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const ticket = await db.supportTicket.create({
      data: {
        userId: session.user.id,
        subject: parsed.data.subject,
        message: parsed.data.message,
        status: "open",
      },
    });

    await db.notification.create({
      data: {
        userId: session.user.id,
        type: "support",
        title: "Support ticket created",
        message: `Ticket ${ticket.id} submitted`,
      },
    });

    return NextResponse.json({ success: true, ticket });
  } catch {
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}


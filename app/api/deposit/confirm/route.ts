import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { runFixedPayoutEngine } from "@/lib/mlm-logic";

const schema = z.object({
  sourceUserId: z.string().min(12),
  amount: z.number().positive(),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (session.user.status !== "admin" && session.user.id !== parsed.data.sourceUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await runFixedPayoutEngine({
      sourceUserId: parsed.data.sourceUserId,
      depositAmount: parsed.data.amount,
      note: parsed.data.note,
    });

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: "Deposit confirmation failed" }, { status: 500 });
  }
}

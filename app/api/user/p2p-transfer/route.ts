import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

const schema = z.object({
  recipient: z.string().min(3),
  amount: z.number().positive(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.status === "inactive") {
      return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
    }
    if (session.user.status === "blocked") {
      return NextResponse.json({ error: "Account blocked" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const senderId = session.user.id;
    const amt = Number(parsed.data.amount.toFixed(2));
    const key = String(parsed.data.recipient).trim();

    let recipient =
      key.includes("@")
        ? await db.user.findUnique({ where: { email: key.toLowerCase() }, select: { id: true, username: true, email: true, status: true } })
        : await db.user.findUnique({ where: { referrerCode: key }, select: { id: true, username: true, email: true, status: true } });

    if (!recipient) {
      recipient = await db.user.findFirst({ where: { username: key }, select: { id: true, username: true, email: true, status: true } });
    }
    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }
    if (recipient.id === senderId) {
      return NextResponse.json({ error: "Cannot transfer to self" }, { status: 400 });
    }
    if (recipient.status === "inactive" || recipient.status === "blocked") {
      return NextResponse.json({ error: "Recipient unavailable" }, { status: 400 });
    }

    const sender = await db.user.findUnique({ where: { id: senderId }, select: { id: true, username: true, balance: true } });
    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }
    const bal = Number(sender.balance ?? 0);
    if (bal < amt) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: senderId },
        data: { balance: { decrement: new Prisma.Decimal(amt.toFixed(2)) } },
      });
      await tx.user.update({
        where: { id: recipient!.id },
        data: { balance: { increment: new Prisma.Decimal(amt.toFixed(2)) } },
      });
      await tx.transaction.create({
        data: {
          userId: senderId,
          sourceUserId: senderId,
          level: 0,
          amount: new Prisma.Decimal((-amt).toFixed(2)),
          type: "adjustment",
          note: `P2P to ${recipient!.username} (${recipient!.id})`,
        },
      });
      await tx.transaction.create({
        data: {
          userId: recipient!.id,
          sourceUserId: senderId,
          level: 0,
          amount: new Prisma.Decimal(amt.toFixed(2)),
          type: "adjustment",
          note: `P2P from ${sender.username} (${senderId})`,
        },
      });
      await tx.notification.create({
        data: {
          userId: recipient!.id,
          type: "system",
          title: "P2P Transfer Received",
          message: `You received ${amt} from ${sender.username}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "P2P transfer failed" }, { status: 500 });
  }
}

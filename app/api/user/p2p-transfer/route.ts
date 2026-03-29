import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

const schema = z.object({
  recipient: z.string().min(3),
  amount: z.number().positive(),
  securityCode: z.string().min(1),
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
    const senderId = session.user.id;
    const { amount, recipient: key, securityCode } = parsed.data;
    const amt = Number(amount.toFixed(2));

    const sender = await db.user.findUnique({ where: { id: senderId } });
    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    // Handle security code check with raw query if prisma client is outdated
    let senderSecurityCode = (sender as any).securityCode;
    if (senderSecurityCode === undefined) {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT "securityCode" FROM "User" WHERE id = $1`,
        senderId
      );
      senderSecurityCode = rows[0]?.securityCode;
    }

    if (!senderSecurityCode) {
      return NextResponse.json({ error: "Security code not set. Please set it in My Profile." }, { status: 400 });
    }

    if (senderSecurityCode !== securityCode) {
      return NextResponse.json({ error: "Invalid security code" }, { status: 401 });
    }

    // Safely get usdtBalance
    let usdtBalance = Number((sender as any).usdtBalance ?? 0);
    if ((sender as any).usdtBalance === undefined) {
      try {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT "usdtBalance" FROM "User" WHERE id = $1`,
          senderId
        );
        usdtBalance = Number(rows[0]?.usdtBalance ?? 0);
      } catch (err) {
        usdtBalance = 0;
      }
    }

    if (usdtBalance < amt) {
      return NextResponse.json({ error: "Insufficient balance in USDT wallet" }, { status: 400 });
    }

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

    await db.$transaction(async (tx) => {
      // Update usdtBalance using raw SQL if necessary
      try {
        await tx.user.update({
          where: { id: senderId },
          data: { usdtBalance: { decrement: new Prisma.Decimal(amt.toFixed(2)) } } as any,
        });
      } catch (e) {
        await tx.$executeRawUnsafe(
          `UPDATE "User" SET "usdtBalance" = "usdtBalance" - $1 WHERE id = $2`,
          amt, senderId
        );
      }
      
      await tx.user.update({
        where: { id: recipient!.id },
        data: { usdtBalance: { increment: new Prisma.Decimal(amt.toFixed(2)) } } as any,
      });
      await tx.transaction.create({
        data: {
          userId: senderId,
          sourceUserId: senderId,
          level: 0,
          amount: new Prisma.Decimal((-amt).toFixed(2)),
          type: "adjustment",
          note: `P2P to ${recipient!.username} (from USDT wallet)`,
        },
      });
      await tx.transaction.create({
        data: {
          userId: recipient!.id,
          sourceUserId: senderId,
          level: 0,
          amount: new Prisma.Decimal(amt.toFixed(2)),
          type: "adjustment",
          note: `P2P from ${sender.username} (to USDT wallet)`,
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

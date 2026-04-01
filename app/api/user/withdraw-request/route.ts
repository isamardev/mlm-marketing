import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

const schema = z.object({
  amount: z.number().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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
    const userId = session.user.id;
    const { amount, address, securityCode } = parsed.data;

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has a permanent withdrawal address set
    let permanentWithdrawAddress = (user as any).permanentWithdrawAddress;
    if (permanentWithdrawAddress === undefined) {
      try {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT "permanentWithdrawAddress" FROM "User" WHERE id = $1`,
          userId
        );
        if (rows && rows.length > 0) {
          permanentWithdrawAddress = rows[0].permanentWithdrawAddress ?? rows[0].permanentwithdrawaddress;
        }
      } catch (err) {
        permanentWithdrawAddress = null;
      }
    }

    if (permanentWithdrawAddress && address !== permanentWithdrawAddress) {
      return NextResponse.json({ error: "Withdrawals only allowed to your saved permanent address" }, { status: 400 });
    }

    // Handle security code check with raw query if prisma client is outdated
    let userSecurityCode = (user as any).securityCode;
    if (userSecurityCode === undefined) {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT "securityCode" FROM "User" WHERE id = $1`,
        userId
      );
      userSecurityCode = rows[0]?.securityCode;
    }

    if (!userSecurityCode) {
      return NextResponse.json({ error: "Security code not set. Please set it in My Profile." }, { status: 400 });
    }

    if (userSecurityCode !== securityCode) {
      return NextResponse.json({ error: "Invalid security code" }, { status: 401 });
    }

    // Safely get withdrawBalance
    let withdrawBalance = Number((user as any).withdrawBalance ?? 0);
    if ((user as any).withdrawBalance === undefined) {
      try {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT "withdrawBalance" FROM "User" WHERE id = $1`,
          userId
        );
        withdrawBalance = Number(rows[0]?.withdrawBalance ?? 0);
      } catch (err) {
        withdrawBalance = 0;
      }
    }

    const amt = Number(amount.toFixed(2));
    if (withdrawBalance < amt) {
      return NextResponse.json({ error: "Insufficient balance in withdrawal wallet" }, { status: 400 });
    }

    const withdrawal = await db.$transaction(async (tx) => {
      // Update withdrawBalance using raw SQL if necessary
      try {
        await tx.user.update({
          where: { id: userId },
          data: { withdrawBalance: { decrement: new Prisma.Decimal(amt.toFixed(2)) } } as any,
        });
      } catch (e) {
        await tx.$executeRawUnsafe(
          `UPDATE "User" SET "withdrawBalance" = "withdrawBalance" - $1 WHERE id = $2`,
          amt, userId
        );
      }
      
      await tx.transaction.create({
        data: {
          userId,
          sourceUserId: userId,
          level: 0,
          amount: new Prisma.Decimal((-amt).toFixed(2)),
          type: "adjustment",
          note: "Withdrawal request lock (from withdraw wallet)",
        },
      });
      const w = await tx.withdrawal.create({
        data: {
          userId,
          address,
          amount: new Prisma.Decimal(amt.toFixed(2)),
          status: "pending",
        },
      });
      await tx.notification.create({
        data: {
          userId,
          type: "system",
          title: "Withdrawal requested",
          message: `Amount ${amt} to ${address}`,
        },
      });
      return w;
    });

    return NextResponse.json({ success: true, withdrawal });
  } catch {
    return NextResponse.json({ error: "Withdrawal request failed" }, { status: 500 });
  }
}

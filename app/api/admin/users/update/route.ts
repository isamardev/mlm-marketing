import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { id, username, email, phone, country, balance, withdrawBalance, usdtBalance, status, securityCode } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const db = getDb();

    // Check if user exists
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (country !== undefined) updateData.country = country;
    if (balance !== undefined) updateData.balance = new Prisma.Decimal(Number(balance).toFixed(2));
    if (withdrawBalance !== undefined) updateData.withdrawBalance = new Prisma.Decimal(Number(withdrawBalance).toFixed(2));
    if (usdtBalance !== undefined) updateData.usdtBalance = new Prisma.Decimal(Number(usdtBalance).toFixed(2));
    if (status !== undefined) updateData.status = status;
    if (securityCode !== undefined) updateData.securityCode = securityCode;

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

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

    const { id, username, email, phone, country, balance, withdrawBalance, usdtBalance, status, securityCode, permanentWithdrawAddress } = await req.json();

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
    if (permanentWithdrawAddress !== undefined) updateData.permanentWithdrawAddress = permanentWithdrawAddress;

    try {
      const updatedUser = await db.user.update({
        where: { id },
        data: updateData,
      });
      return NextResponse.json({ success: true, user: updatedUser });
    } catch (e: any) {
      // Fallback to raw SQL if Prisma client is out of sync with columns
      console.warn("Prisma update failed in admin update, trying raw SQL:", e.message);
      
      const setClauses: string[] = [];
      const values: any[] = [];
      let i = 1;

      if (username !== undefined) { setClauses.push(`username = $${i++}`); values.push(username); }
      if (email !== undefined) { setClauses.push(`email = $${i++}`); values.push(email.toLowerCase()); }
      if (phone !== undefined) { setClauses.push(`phone = $${i++}`); values.push(phone); }
      if (country !== undefined) { setClauses.push(`country = $${i++}`); values.push(country); }
      if (balance !== undefined) { setClauses.push(`balance = $${i++}`); values.push(Number(balance)); }
      if (withdrawBalance !== undefined) { setClauses.push(`"withdrawBalance" = $${i++}`); values.push(Number(withdrawBalance)); }
      if (usdtBalance !== undefined) { setClauses.push(`"usdtBalance" = $${i++}`); values.push(Number(usdtBalance)); }
      if (status !== undefined) { setClauses.push(`status = $${i++}`); values.push(status); }
      if (securityCode !== undefined) { setClauses.push(`"securityCode" = $${i++}`); values.push(securityCode); }
      if (permanentWithdrawAddress !== undefined) { setClauses.push(`"permanentWithdrawAddress" = $${i++}`); values.push(permanentWithdrawAddress); }

      if (setClauses.length === 0) {
        return NextResponse.json({ success: true });
      }

      values.push(id);
      const query = `UPDATE "User" SET ${setClauses.join(", ")} WHERE id = $${i}`;
      await db.$executeRawUnsafe(query, ...values);
      
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

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

    const { id, username, email, balance, withdrawBalance, status } = await req.json();

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
    if (balance !== undefined) updateData.balance = new Prisma.Decimal(Number(balance).toFixed(2));
    if (status !== undefined) updateData.status = status;

    // Use transaction to update and handle withdrawBalance safely (as it might be missing in prisma client)
    const updatedUser = await db.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: updateData,
      });

      if (withdrawBalance !== undefined) {
        try {
          await tx.$executeRawUnsafe(
            `UPDATE "User" SET "withdrawBalance" = $1 WHERE id = $2`,
            Number(withdrawBalance), id
          );
        } catch (err) {
          console.error("Failed to update withdrawBalance via raw SQL:", err);
        }
      }
      return u;
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newSecurityCode } = await req.json();

    if (!currentPassword || !newSecurityCode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
    }

    // Update security code
    // Use raw query if prisma client is not generated with securityCode field
    try {
      await db.user.update({
        where: { id: user.id },
        data: { securityCode: newSecurityCode.trim() }
      });
    } catch (e: any) {
      console.error("Prisma update failed, trying raw query:", e.message);
      await db.$executeRawUnsafe(
        `UPDATE "User" SET "securityCode" = $1 WHERE id = $2`,
        newSecurityCode.trim(),
        user.id
      );
    }

    return NextResponse.json({ success: true, message: "Security code updated successfully" });
  } catch (error) {
    console.error("Update security code error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

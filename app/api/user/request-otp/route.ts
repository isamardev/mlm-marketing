import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { isEmailConfigured, sendOtpEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email().optional(),
  purpose: z.enum(["registration", "withdrawal", "password_reset"]),
});

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const email = (parsed.data.email ?? "").toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const storedPurpose = parsed.data.purpose === "password_reset" ? "withdrawal" : parsed.data.purpose;

    const db = getDb();
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user && parsed.data.purpose === "password_reset") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!isEmailConfigured()) {
      return NextResponse.json({ error: "Email service is not configured" }, { status: 500 });
    }

    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.otp.create({
      data: {
        userId: user?.id ?? null,
        email,
        purpose: storedPurpose,
        codeHash,
        expiresAt,
      },
    });

    await sendOtpEmail({
      to: email,
      otp,
      purpose: parsed.data.purpose,
    });

    return NextResponse.json({
      success: true,
      expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to request OTP";
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Failed to request OTP" : message }, { status: 500 });
  }
}

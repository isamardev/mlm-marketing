import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  email: z.string().email().optional(),
  purpose: z.enum(["registration", "withdrawal", "password_reset"]),
  code: z.string().min(4).max(12),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const email = (parsed.data.email ?? session?.user?.email ?? "").toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const storedPurpose = parsed.data.purpose === "password_reset" ? "withdrawal" : parsed.data.purpose;

    const db = getDb();
    const otp = await db.otp.findFirst({
      where: {
        email,
        purpose: storedPurpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json({ error: "OTP not found or expired" }, { status: 400 });
    }

    if (otp.attempts >= 5) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    const ok = await bcrypt.compare(parsed.data.code, otp.codeHash);
    await db.otp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    if (!ok) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    if (parsed.data.purpose !== "password_reset") {
      await db.otp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
    }

    if (parsed.data.purpose === "registration") {
      await db.user.updateMany({
        where: { email },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "OTP verification failed" }, { status: 500 });
  }
}

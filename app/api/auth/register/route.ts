import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

const registerSchema = z.object({
  username: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  referrerCode: z.string().min(4).max(30).optional(),
});

const COMPANY_REF_CODE = "ADMIN111";
const COMPANY_ADMIN_EMAIL = "admin@example.com";

function generateRefCode(name: string) {
  const clean = name.replace(/\s+/g, "").toUpperCase().slice(0, 4) || "USER";
  return `${clean}${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const payload = parsed.data;
    const normalizedEmail = payload.email.toLowerCase();

    const already = await db.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (already) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const userCount = await db.user.count();
    let allowBootstrap = userCount === 0 && normalizedEmail === COMPANY_ADMIN_EMAIL;
    if (userCount === 0 && normalizedEmail !== COMPANY_ADMIN_EMAIL) {
      const existingAdmin = await db.user.findUnique({ where: { email: COMPANY_ADMIN_EMAIL }, select: { id: true } });
      if (!existingAdmin) {
        const adminPasswordHash = await bcrypt.hash("admin123", 12);
        const adminWalletPlaceholder = `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.user.create({
          data: {
            username: "Admin",
            email: COMPANY_ADMIN_EMAIL,
            passwordHash: adminPasswordHash,
            walletAddress: adminWalletPlaceholder,
            referrerCode: COMPANY_REF_CODE,
            referredById: null,
            balance: 0,
            status: "admin",
          },
          select: { id: true },
        });
      }
      allowBootstrap = false;
    }
    const ref = payload.referrerCode?.trim().toUpperCase() ?? "";
    const parentByRef = ref
      ? await db.user.findUnique({ where: { referrerCode: ref }, select: { id: true } })
      : null;
    if (!allowBootstrap && ref && !parentByRef) {
      return NextResponse.json({ error: "Invalid referrerCode" }, { status: 400 });
    }

    const company = !allowBootstrap
      ? await db.user.findUnique({ where: { email: COMPANY_ADMIN_EMAIL }, select: { id: true } })
      : null;
    const parent = allowBootstrap ? null : parentByRef ?? company;
    if (!allowBootstrap && !parent) {
      return NextResponse.json({ error: "Company referrer not found" }, { status: 500 });
    }

    let refCode = generateRefCode(payload.username);
    for (let i = 0; i < 5; i += 1) {
      const exists = await db.user.findUnique({ where: { referrerCode: refCode }, select: { id: true } });
      if (!exists) break;
      refCode = generateRefCode(payload.username);
    }
    if (allowBootstrap) {
      const exists = await db.user.findUnique({ where: { referrerCode: COMPANY_REF_CODE }, select: { id: true } });
      if (exists) {
        return NextResponse.json({ error: "Company referrerCode already exists" }, { status: 409 });
      }
      refCode = COMPANY_REF_CODE;
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    
    // Generate unique placeholder for walletAddress since it has @unique constraint
    const walletPlaceholder = `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const user = await db.user.create({
      data: {
        username: payload.username.trim(),
        email: normalizedEmail,
        passwordHash,
        walletAddress: walletPlaceholder,
        referrerCode: refCode,
        referredById: parent?.id ?? null,
        balance: 0,
        status: allowBootstrap ? "admin" : "active",
      },
      select: { id: true, username: true, email: true, referrerCode: true, referredById: true },
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          referrerCode: user.referrerCode,
          referredBy: user.referredById,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

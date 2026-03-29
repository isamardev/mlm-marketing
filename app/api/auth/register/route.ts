import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

const registerSchema = z.object({
  fullName: z.string().min(2).max(60),
  phone: z.string().min(7).max(20),
  country: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  referrerCode: z.string().min(4).max(30).optional(),
  acceptedTerms: z.literal(true),
});

const COMPANY_REF_CODE = "ADMIN111";
const COMPANY_ADMIN_EMAIL = "admin@example.com";

function generateRefCode(name: string) {
  const clean = name.replace(/\s+/g, "").toUpperCase().slice(0, 4) || "USER";
  return `${clean}${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referrerCode = (url.searchParams.get("referrerCode") || "").trim().toUpperCase();
    if (!referrerCode) {
      return NextResponse.json({ error: "Referrer code is required" }, { status: 400 });
    }

    const db = getDb();
    const referrer = await db.user.findUnique({
      where: { referrerCode },
      select: { username: true, status: true },
    });

    if (!referrer || referrer.status === "inactive") {
      return NextResponse.json({ error: "Referrer not found" }, { status: 404 });
    }

    return NextResponse.json({ fullName: referrer.username });
  } catch {
    return NextResponse.json({ error: "Failed to fetch referrer" }, { status: 500 });
  }
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
            country: "Pakistan",
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
      ? await db.user.findUnique({ where: { referrerCode: ref }, select: { id: true, status: true } })
      : null;
    if (!allowBootstrap && ref && !parentByRef) {
      return NextResponse.json({ error: "Invalid referrerCode" }, { status: 400 });
    }

    const company = !allowBootstrap
      ? await db.user.findUnique({ where: { email: COMPANY_ADMIN_EMAIL }, select: { id: true, status: true } })
      : null;
    const parent = allowBootstrap ? null : parentByRef ?? company;
    if (!allowBootstrap && !parent) {
      return NextResponse.json({ error: "Company referrer not found" }, { status: 500 });
    }

    const REFERRAL_WINDOW_MS = 24 * 60 * 60 * 1000;
    if (!allowBootstrap && parentByRef && parentByRef.status !== "admin") {
      const parentVerified = await db.deposit.findFirst({
        where: { userId: parentByRef.id, status: "confirmed" },
        select: { id: true },
      });
      if (!parentVerified) {
        return NextResponse.json({ error: "Referrer not verified yet" }, { status: 400 });
      }
      const nowMs = Date.now();
      const direct = await db.user.findMany({
        where: { referredById: parentByRef.id, status: { not: "inactive" } },
        select: { id: true, createdAt: true, status: true },
      });

      let inUse = 0;
      const deactivateIds: string[] = [];
      for (const child of direct) {
        if (child.status === "inactive") continue;
        const expiresAt = new Date(child.createdAt.getTime() + REFERRAL_WINDOW_MS);
        const verified = await db.deposit.findFirst({
          where: { userId: child.id, status: "confirmed", createdAt: { lte: expiresAt } },
          select: { id: true },
        });
        if (verified) {
          inUse += 1;
          continue;
        }
        if (nowMs > expiresAt.getTime()) {
          deactivateIds.push(child.id);
          continue;
        }
        inUse += 1;
      }
      if (deactivateIds.length > 0) {
        await db.user.updateMany({ where: { id: { in: deactivateIds } }, data: { status: "inactive" } });
      }
      if (inUse >= 2) {
        return NextResponse.json({ error: "Referrer quota reached (2/2)" }, { status: 400 });
      }
    }

    let refCode = generateRefCode(payload.fullName);
    for (let i = 0; i < 5; i += 1) {
      const exists = await db.user.findUnique({ where: { referrerCode: refCode }, select: { id: true } });
      if (!exists) break;
      refCode = generateRefCode(payload.fullName);
    }
    if (allowBootstrap) {
      const exists = await db.user.findUnique({ where: { referrerCode: COMPANY_REF_CODE }, select: { id: true } });
      if (exists) {
        return NextResponse.json({ error: "Company referrerCode already exists" }, { status: 409 });
      }
      refCode = COMPANY_REF_CODE;
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const walletPlaceholder = `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const user = await db.user.create({
      data: {
        username: payload.fullName.trim(),
        country: payload.country.trim(),
        email: normalizedEmail,
        passwordHash,
        walletAddress: walletPlaceholder,
        referrerCode: refCode,
        referredById: parent?.id ?? null,
        balance: 0,
        status: allowBootstrap ? "admin" : "inactive",
        emailVerifiedAt: null,
      },
      select: { id: true, username: true, email: true, referrerCode: true, referredById: true },
    });

    // Update phone number using raw SQL to avoid Prisma client sync issues
    try {
      await db.$executeRawUnsafe(
        `UPDATE "User" SET phone = $1 WHERE id = $2`,
        payload.phone.trim(),
        user.id
      );
    } catch (e) {
      console.error("Failed to update phone number:", e);
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Registration failed" : message },
      { status: 500 },
    );
  }
}

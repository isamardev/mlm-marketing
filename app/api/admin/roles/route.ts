import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-api-guard";
import { normalizeAdminPermissionList } from "@/lib/admin-permissions";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  permissions: z.array(z.string()).optional(),
  staffEmail: z.string().email(),
  staffPassword: z.string().min(6).max(200),
  staffName: z.string().min(1).max(80),
});

/** Use main `db` — interactive `$transaction(tx => ...)` omits `adminRole` on the WASM client. */
async function uniqueWalletForRole(db: Pick<PrismaClient, "user">, roleId: string): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const w = `role_${roleId}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 14)}`;
    const exists = await db.user.findUnique({ where: { walletAddress: w }, select: { id: true } });
    if (!exists) return w;
  }
  throw new Error("Could not allocate wallet");
}

async function uniqueReferrerCode(db: Pick<PrismaClient, "user">): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const code = `S${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 14);
    const exists = await db.user.findUnique({ where: { referrerCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Could not allocate referral code");
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  permissions: z.array(z.string()).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  try {
    const db = getDb();
    const roles = await db.adminRole.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true } },
        users: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { email: true, username: true },
        },
      },
    });
    return NextResponse.json({ roles });
  } catch (e) {
    console.error("admin roles GET", e);
    return NextResponse.json({ error: "Failed to list roles" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const permissions = normalizeAdminPermissionList(parsed.data.permissions ?? []);
    const email = parsed.data.staffEmail.toLowerCase().trim();
    const db = getDb();

    const existingEmail = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingEmail) {
      return NextResponse.json({ error: "This email is already registered" }, { status: 400 });
    }

    const created = await db.adminRole.create({
      data: {
        name: parsed.data.name.trim(),
        permissions,
      },
      select: { id: true },
    });

    try {
      const passwordHash = await bcrypt.hash(parsed.data.staffPassword, 12);
      const walletAddress = await uniqueWalletForRole(db, created.id);
      const referrerCode = await uniqueReferrerCode(db);
      await db.user.create({
        data: {
          username: parsed.data.staffName.trim(),
          email,
          passwordHash,
          walletAddress,
          referrerCode,
          country: "",
          status: "admin",
          adminRoleId: created.id,
          referredById: null,
        },
      });
    } catch (inner) {
      await db.adminRole.delete({ where: { id: created.id } }).catch(() => undefined);
      throw inner;
    }

    const role = await db.adminRole.findUniqueOrThrow({
      where: { id: created.id },
      select: { id: true, name: true, permissions: true },
    });

    return NextResponse.json({ role });
  } catch (e) {
    console.error("admin roles POST", e);
    const msg = e instanceof Error ? e.message : "Failed to create role";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  try {
    const json = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = getDb();
    const existing = await db.adminRole.findUnique({ where: { id: parsed.data.id } });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    const data: { name?: string; permissions?: object } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.permissions !== undefined) {
      data.permissions = normalizeAdminPermissionList(parsed.data.permissions);
    }
    const role = await db.adminRole.update({
      where: { id: parsed.data.id },
      data,
      select: { id: true, name: true, permissions: true },
    });
    return NextResponse.json({ role });
  } catch (e) {
    console.error("admin roles PATCH", e);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const parsed = deleteSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const db = getDb();
    await db.user.deleteMany({ where: { adminRoleId: parsed.data.id } });
    await db.adminRole.delete({ where: { id: parsed.data.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("admin roles DELETE", e);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}

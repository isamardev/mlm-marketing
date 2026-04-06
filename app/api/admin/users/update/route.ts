import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireAdminSection, requireSuperAdmin } from "@/lib/admin-api-guard";
import { runActivationPayoutEngine } from "@/lib/mlm-logic";
import { MANUAL_SUSPEND_SOURCE } from "@/lib/team-withdraw-activity";

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

async function getUsdtBalanceFromDb(db: ReturnType<typeof getDb>, userId: string): Promise<number> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ v: unknown }>>(
      `SELECT COALESCE("usdtBalance", 0) AS v FROM "User" WHERE id = $1`,
      userId,
    );
    return Number(rows?.[0]?.v ?? 0);
  } catch {
    return 0;
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await requireAdminSection("users");
    if (!gate.ok) return gate.response;
    const canEditBalances = gate.fullAccess === true;

    const body = await req.json();
    const {
      id,
      username,
      email,
      phone,
      country,
      balance,
      withdrawBalance,
      usdtBalance,
      status,
      securityCode,
      permanentWithdrawAddress,
      adminRoleId,
      newPassword,
    } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const db = getDb();

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const oldUsdt = await getUsdtBalanceFromDb(db, id);

    const prismaData: Record<string, unknown> = {};
    if (username !== undefined && username !== null) {
      prismaData.username = String(username).trim();
    }
    if (email !== undefined && email !== null) {
      prismaData.email = String(email).trim().toLowerCase();
    }
    if (phone !== undefined && phone !== null) {
      prismaData.phone = String(phone);
    }
    if (country !== undefined && country !== null) {
      prismaData.country = String(country);
    }
    if (canEditBalances && balance !== undefined && balance !== null) {
      prismaData.balance = new Prisma.Decimal(num(balance).toFixed(2));
    }
    if (canEditBalances && withdrawBalance !== undefined && withdrawBalance !== null) {
      prismaData.withdrawBalance = new Prisma.Decimal(num(withdrawBalance).toFixed(2));
    }
    if (status !== undefined && status !== null) {
      prismaData.status = status;
      const st = String(status);
      if (st === "withdraw_suspend") {
        prismaData.withdrawSuspendSource = MANUAL_SUSPEND_SOURCE;
      } else {
        prismaData.withdrawSuspendSource = null;
      }
    }
    if (securityCode !== undefined) {
      const s = String(securityCode ?? "").trim();
      prismaData.securityCode = s.length ? s : null;
    }

    const np = typeof newPassword === "string" ? newPassword.trim() : "";
    if (np.length > 0) {
      if (np.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
      }
      prismaData.passwordHash = await bcrypt.hash(np, 12);
      if (user.adminRoleId || user.status === "admin") {
        prismaData.staffPasswordPlain = np;
      } else {
        prismaData.staffPasswordPlain = null;
      }
    }

    if (adminRoleId !== undefined) {
      const superGate = await requireSuperAdmin();
      if (!superGate.ok) return superGate.response;
      const raw = adminRoleId === null || adminRoleId === "" ? null : String(adminRoleId);
      if (raw) {
        const role = await db.adminRole.findUnique({ where: { id: raw } });
        if (!role) {
          return NextResponse.json({ error: "Invalid admin role" }, { status: 400 });
        }
        prismaData.adminRoleId = raw;
      } else {
        prismaData.adminRoleId = null;
      }
    }

    const newUsdt =
      usdtBalance !== undefined && canEditBalances ? num(usdtBalance) : oldUsdt;
    const usdtDelta =
      usdtBalance !== undefined && canEditBalances ? newUsdt - oldUsdt : 0;

    const extraClauses: string[] = [];
    const extraVals: unknown[] = [];
    let p = 1;
    if (usdtBalance !== undefined && canEditBalances) {
      extraClauses.push(`"usdtBalance" = $${p++}`);
      extraVals.push(newUsdt);
    }
    if (permanentWithdrawAddress !== undefined) {
      extraClauses.push(`"permanentWithdrawAddress" = $${p++}`);
      extraVals.push(String(permanentWithdrawAddress ?? "").trim());
    }

    const willActivate =
      status !== undefined &&
      status !== null &&
      String(status) === "active" &&
      user.status === "inactive";

    if (willActivate) {
      await runActivationPayoutEngine({
        sourceUserId: id,
        activationAmount: 10,
        note: "Admin activation",
        skipUserDeduction: true,
      });
      delete prismaData.status;
    }

    await db.$transaction(async (tx) => {
      if (Object.keys(prismaData).length > 0) {
        await tx.user.update({
          where: { id },
          data: prismaData as Prisma.UserUpdateInput,
        });
      }

      if (extraClauses.length > 0) {
        extraVals.push(id);
        await tx.$executeRawUnsafe(
          `UPDATE "User" SET ${extraClauses.join(", ")} WHERE id = $${p}`,
          ...extraVals,
        );
      }

      // Total Deposits on admin dashboard = sum of confirmed Deposit rows; manual Balance (USDT) credits must log here too
      if (canEditBalances && usdtBalance !== undefined && usdtDelta > 0.0001) {
        const txHash = `admin-panel-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
        await tx.deposit.create({
          data: {
            userId: id,
            chain: "BSC",
            txHash,
            amount: new Prisma.Decimal(usdtDelta.toFixed(2)),
            status: "confirmed",
            verifiedAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Admin user update error:", error);
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

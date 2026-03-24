import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";

type PayoutResult = {
  level: number;
  beneficiaryUserId: string;
  amount: number;
};

export const MLM_SETTINGS_KEY = "mlm-level-percentages";
export const DEFAULT_LEVEL_PERCENTAGES = [
  10, 5, 4, 3, 2, 2, 1.5, 1.5, 1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.4, 0.4, 0.3, 0.3,
];

export async function ensureDefaultSettings() {
  const db = getDb();
  const setting = await db.setting.findUnique({ where: { key: MLM_SETTINGS_KEY } });
  if (setting) return setting;
  return db.setting.create({
    data: {
      key: MLM_SETTINGS_KEY,
      levelPercentages: DEFAULT_LEVEL_PERCENTAGES,
    },
  });
}

export async function runMlmPayoutEngine(params: {
  sourceUserId: string;
  depositAmount: number;
  note?: string;
}) {
  const db = getDb();
  const sourceUserId = params.sourceUserId;
  const depositAmount = params.depositAmount;
  const note = params.note ?? "Deposit confirmation";

  const setting = await ensureDefaultSettings();
  const levelPercentages = (setting.levelPercentages as number[]) ?? DEFAULT_LEVEL_PERCENTAGES;

  const payouts: PayoutResult[] = [];

  await db.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        userId: sourceUserId,
        sourceUserId,
        level: 0,
        amount: new Prisma.Decimal(depositAmount.toFixed(2)),
        type: "deposit",
        note,
      },
    });

    const sourceUser = await tx.user.findUnique({
      where: { id: sourceUserId },
      select: { id: true, referredById: true },
    });
    if (!sourceUser) {
      throw new Error("Source user not found");
    }

    let currentParentId = sourceUser.referredById;

    for (let level = 1; level <= 20; level += 1) {
      if (!currentParentId) break;
      const pct = levelPercentages[level - 1] ?? 0;
      const amountNum = Number(((depositAmount * pct) / 100).toFixed(2));
      if (amountNum > 0) {
        await tx.user.update({
          where: { id: currentParentId },
          data: { balance: { increment: new Prisma.Decimal(amountNum.toFixed(2)) } },
        });
        await tx.notification.create({
          data: {
            userId: currentParentId,
            type: "commission",
            title: `L${level} Commission`,
            message: `You received ${amountNum} from ${sourceUserId}`,
          },
        });
        await tx.transaction.create({
          data: {
            userId: currentParentId,
            sourceUserId,
            level,
            amount: new Prisma.Decimal(amountNum.toFixed(2)),
            type: "commission",
            note: `L${level} commission from ${sourceUserId}`,
          },
        });
        payouts.push({ level, beneficiaryUserId: currentParentId, amount: amountNum });
      }

      const parent = await tx.user.findUnique({
        where: { id: currentParentId },
        select: { referredById: true },
      });
      currentParentId = parent?.referredById ?? null;
    }
  });

  return { sourceUserId, depositAmount, payouts };
}

export async function runFixedPayoutEngine(params: {
  sourceUserId: string;
  depositAmount: number;
  note?: string;
}) {
  const db = getDb();
  const sourceUserId = params.sourceUserId;
  const depositAmount = params.depositAmount;
  const note = params.note ?? "Deposit confirmation";
  const perLevel = 0.5;
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();

  const payouts: PayoutResult[] = [];

  await db.$transaction(async (tx) => {
    // Create gross deposit record
    await tx.transaction.create({
      data: {
        userId: sourceUserId,
        sourceUserId,
        level: 0,
        amount: new Prisma.Decimal(depositAmount.toFixed(2)),
        type: "deposit",
        note,
      },
    });

    const adminByStatus = await tx.user.findFirst({ where: { status: "admin" }, select: { id: true, email: true } });
    const adminByEmail = adminByStatus ?? (await tx.user.findUnique({ where: { email: adminEmail }, select: { id: true, email: true } }));
    const adminId = adminByEmail?.id || null;

    const sourceUser = await tx.user.findUnique({
      where: { id: sourceUserId },
      select: { id: true, referredById: true },
    });
    if (!sourceUser) {
      throw new Error("Source user not found");
    }

    let currentParentId = sourceUser.referredById;

    for (let level = 1; level <= 20; level += 1) {
      let beneficiaryId = currentParentId || adminId;
      if (!beneficiaryId) break;

      await tx.user.update({
        where: { id: beneficiaryId },
        data: { balance: { increment: new Prisma.Decimal(perLevel.toFixed(2)) } },
      });
      await tx.transaction.create({
        data: {
          userId: beneficiaryId,
          sourceUserId,
          level,
          amount: new Prisma.Decimal(perLevel.toFixed(2)),
          type: "commission",
          note: `L${level} fixed payout from ${sourceUserId}`,
        },
      });
      payouts.push({ level, beneficiaryUserId: beneficiaryId, amount: perLevel });

      if (!currentParentId) continue;
      const parent = await tx.user.findUnique({
        where: { id: currentParentId },
        select: { referredById: true },
      });
      currentParentId = parent?.referredById ?? null;
    }

    // Deduct commissions from depositor and credit net deposit
    const totalCommission = Number((payouts.length * perLevel).toFixed(2));
    if (depositAmount < totalCommission) {
      throw new Error("Deposit less than required commissions");
    }
    const net = Number((depositAmount - totalCommission).toFixed(2));
    if (net > 0) {
      await tx.user.update({
        where: { id: sourceUserId },
        data: { balance: { increment: new Prisma.Decimal(net.toFixed(2)) } },
      });
    }
    await tx.transaction.create({
      data: {
        userId: sourceUserId,
        sourceUserId,
        level: 0,
        amount: new Prisma.Decimal((-totalCommission).toFixed(2)),
        type: "adjustment",
        note: `Commission deduction (${payouts.length} levels)`,
      },
    });
  });

  return { sourceUserId, depositAmount, payouts };
}


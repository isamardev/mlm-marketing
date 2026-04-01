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

export async function runActivationPayoutEngine(params: {
  sourceUserId: string;
  activationAmount: number;
  note?: string;
}) {
  const db = getDb();
  const sourceUserId = params.sourceUserId;
  const activationAmount = params.activationAmount;
  const note = params.note ?? "Account activation";
  const perLevel = 0.5;
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();

  const payouts: PayoutResult[] = [];

  await db.$transaction(async (tx) => {
    // 1. Deduct activation amount and set status to active
    const user = await tx.user.update({
      where: { id: sourceUserId },
      data: { 
        balance: { decrement: new Prisma.Decimal(activationAmount.toFixed(2)) },
        status: "active"
      },
      select: { id: true, referredById: true, username: true, balance: true }
    });

    if (Number(user.balance) < 0) {
      throw new Error("Insufficient balance for activation");
    }

    // 2. Create activation transaction
    await tx.transaction.create({
      data: {
        userId: sourceUserId,
        sourceUserId,
        level: 0,
        amount: new Prisma.Decimal(activationAmount.toFixed(2)),
        type: "activation",
        note,
      },
    });

    const adminByStatus = await tx.user.findFirst({
      where: { status: "admin" },
      select: { id: true, email: true, username: true },
    });
    const adminByEmail =
      adminByStatus ??
      (await tx.user.findUnique({ where: { email: adminEmail }, select: { id: true, email: true, username: true } }));
    const adminId = adminByEmail?.id ?? null;
    if (!adminId) {
      throw new Error("Admin user not found");
    }

    let currentParentId = user.referredById;
    let remainingAmount = Number(activationAmount.toFixed(2));

    for (let level = 1; level <= 20 && currentParentId && remainingAmount >= perLevel; level += 1) {
      const beneficiaryId = currentParentId;

      await tx.user.update({
        where: { id: beneficiaryId },
        data: { balance: { increment: new Prisma.Decimal(perLevel.toFixed(2)) } },
      });
      await tx.notification.create({
        data: {
          userId: beneficiaryId,
          type: "commission",
          title: `L${level} Commission`,
          message: `You received ${perLevel.toFixed(2)} from ${user.username} activation`,
        },
      });
      await tx.transaction.create({
        data: {
          userId: beneficiaryId,
          sourceUserId,
          level,
          amount: new Prisma.Decimal(perLevel.toFixed(2)),
          type: "commission",
          note: `L${level} activation commission from ${sourceUserId}`,
        },
      });
      payouts.push({ level, beneficiaryUserId: beneficiaryId, amount: perLevel });
      remainingAmount = Number((remainingAmount - perLevel).toFixed(2));

      const parent = await tx.user.findUnique({
        where: { id: currentParentId },
        select: { referredById: true },
      });
      currentParentId = parent?.referredById ?? null;
    }

    if (remainingAmount > 0) {
      await tx.user.update({
        where: { id: adminId },
        data: { balance: { increment: new Prisma.Decimal(remainingAmount.toFixed(2)) } },
      });
      await tx.notification.create({
        data: {
          userId: adminId,
          type: "commission",
          title: "Admin Activation Share",
          message: `You received ${remainingAmount.toFixed(2)} from ${user.username} activation`,
        },
      });
      await tx.transaction.create({
        data: {
          userId: adminId,
          sourceUserId,
          level: 0,
          amount: new Prisma.Decimal(remainingAmount.toFixed(2)),
          type: "commission",
          note: `Admin activation share from ${sourceUserId}`,
        },
      });
    }
  });

  return { sourceUserId, activationAmount, payouts };
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

    const adminByStatus = await tx.user.findFirst({
      where: { status: "admin" },
      select: { id: true, email: true, username: true },
    });
    const adminByEmail =
      adminByStatus ??
      (await tx.user.findUnique({ where: { email: adminEmail }, select: { id: true, email: true, username: true } }));
    const adminId = adminByEmail?.id ?? null;
    if (!adminId) {
      throw new Error("Admin user not found");
    }

    const sourceUser = await tx.user.findUnique({
      where: { id: sourceUserId },
      select: { id: true, referredById: true, username: true },
    });
    if (!sourceUser) {
      throw new Error("Source user not found");
    }

    let currentParentId = sourceUser.referredById;
    let remainingAmount = Number(depositAmount.toFixed(2));

    for (let level = 1; level <= 20 && currentParentId && remainingAmount >= perLevel; level += 1) {
      const beneficiaryId = currentParentId;

      await tx.user.update({
        where: { id: beneficiaryId },
        data: { balance: { increment: new Prisma.Decimal(perLevel.toFixed(2)) } },
      });
      await tx.notification.create({
        data: {
          userId: beneficiaryId,
          type: "commission",
          title: `L${level} Commission`,
          message: `You received ${perLevel.toFixed(2)} from ${sourceUser.username}`,
        },
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
      remainingAmount = Number((remainingAmount - perLevel).toFixed(2));

      const parent = await tx.user.findUnique({
        where: { id: currentParentId },
        select: { referredById: true },
      });
      currentParentId = parent?.referredById ?? null;
    }

    if (remainingAmount > 0) {
      await tx.user.update({
        where: { id: adminId },
        data: { balance: { increment: new Prisma.Decimal(remainingAmount.toFixed(2)) } },
      });
      await tx.notification.create({
        data: {
          userId: adminId,
          type: "commission",
          title: "Admin Deposit Share",
          message: `You received ${remainingAmount.toFixed(2)} from ${sourceUser.username}`,
        },
      });
      await tx.transaction.create({
        data: {
          userId: adminId,
          sourceUserId,
          level: 0,
          amount: new Prisma.Decimal(remainingAmount.toFixed(2)),
          type: "commission",
          note: `Admin share from ${sourceUserId}`,
        },
      });
    }
  });

  return { sourceUserId, depositAmount, payouts };
}


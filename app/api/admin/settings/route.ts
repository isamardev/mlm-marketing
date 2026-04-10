import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  coalesceBep20ForSave,
  readWhatsAppAndReceiverFromDb,
  writeWhatsAppAndReceiverToDb,
} from "@/lib/receiver-wallet";
import { requireAdminSection } from "@/lib/admin-api-guard";
import { DEFAULT_LEVEL_PERCENTAGES, MLM_SETTINGS_KEY } from "@/lib/mlm-logic";

const BEP20_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const patchSchema = z.object({
  levelPercentages: z.array(z.number().min(0)).length(20).optional(),
  whatsappNumber: z.string().optional(),
  receiverWalletAddress: z.string().optional(),
});

async function ensureSettingsColumns(db: ReturnType<typeof getDb>) {
  try {
    await db.$executeRawUnsafe(
      `ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT DEFAULT ''`,
    );
  } catch {
    /* older PG without IF NOT EXISTS — ignore */
  }
  try {
    await db.$executeRawUnsafe(
      `ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "receiverWalletAddress" TEXT`,
    );
  } catch {
    /* ignore */
  }
}

async function ensureSettingsRow(db: ReturnType<typeof getDb>) {
  let setting = await db.setting.findUnique({ where: { key: MLM_SETTINGS_KEY } });
  if (!setting) {
    setting = await db.setting.create({
      data: {
        key: MLM_SETTINGS_KEY,
        levelPercentages: DEFAULT_LEVEL_PERCENTAGES,
      },
    });
  }
  return setting;
}

async function readSettingsExtras(db: ReturnType<typeof getDb>) {
  return readWhatsAppAndReceiverFromDb(db);
}

export async function PATCH(req: Request) {
  try {
    const gate = await requireAdminSection("settings");
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const { whatsappNumber, receiverWalletAddress } = parsed.data;

    await ensureSettingsColumns(db);

    const normalizedReceiverWalletAddress =
      receiverWalletAddress === undefined
        ? undefined
        : coalesceBep20ForSave(receiverWalletAddress);
    if (
      normalizedReceiverWalletAddress !== undefined &&
      normalizedReceiverWalletAddress.length > 0 &&
      !BEP20_ADDRESS_RE.test(normalizedReceiverWalletAddress)
    ) {
      return NextResponse.json({ error: "INVALID_RECEIVER_ADDRESS" }, { status: 400 });
    }
    await ensureSettingsRow(db);

    // Use Prisma updates so we always write the schema column `"receiverWalletAddress"` (PostgreSQL
    // raw SQL without quotes targets a different lowercase column than Prisma migrations).
    const data: { whatsapp?: string; receiverWalletAddress?: string | null } = {};
    if (whatsappNumber !== undefined) data.whatsapp = whatsappNumber;
    if (normalizedReceiverWalletAddress !== undefined) {
      data.receiverWalletAddress = normalizedReceiverWalletAddress || null;
    }
    if (Object.keys(data).length > 0) {
      await writeWhatsAppAndReceiverToDb(db, data);
    }

    const fresh = await readSettingsExtras(db);

    return NextResponse.json({
      success: true,
      whatsappNumber: fresh.whatsapp,
      receiverWalletAddress: fresh.receiverWalletAddress,
    });
  } catch (e) {
    console.error("PATCH /api/admin/settings:", e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const gate = await requireAdminSection("settings");
    if (!gate.ok) return gate.response;

    const db = getDb();
    await ensureSettingsColumns(db);

    const setting = await ensureSettingsRow(db);
    const extras = await readSettingsExtras(db);

    return NextResponse.json({
      key: setting.key,
      levelPercentages: setting.levelPercentages,
      whatsappNumber: extras.whatsapp,
      receiverWalletAddress: extras.receiverWalletAddress,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

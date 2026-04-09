import type { PrismaClient } from "@prisma/client";
import { getDb } from "@/lib/db";
import { MLM_SETTINGS_KEY } from "@/lib/mlm-logic";

export const DEFAULT_RECEIVER_WALLET_ADDRESS = "0x000ed6c7f4c9de18b91b60691baa27ec4f1b0000";
export const RECEIVER_WALLET_NETWORK = "BEP20 (BSC)";
export const RECEIVER_WALLET_TOKEN = "USDT";

const BEP20_HEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * If the field is already one clean `0x` + 40 hex string, keep it exactly (no re-parsing).
 * Otherwise fall back to {@link normalizeBep20AddressInput} for messy/HTML pastes.
 */
export function coalesceBep20ForSave(raw: string): string {
  const z = String(raw)
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .trim();
  const compact = z.replace(/\s+/g, "");
  if (/^0x[a-fA-F0-9]{40}$/i.test(compact)) return compact;
  return normalizeBep20AddressInput(raw);
}

/**
 * Strip zero-width chars and extract a BEP20 address from pasted text (multiple addresses → first match).
 */
export function normalizeBep20AddressInput(raw: string): string {
  const cleaned = String(raw)
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .trim();
  const noSpace = cleaned.replace(/\s+/g, "");
  const single = noSpace.match(/^(0x[a-fA-F0-9]{40})$/i);
  if (single) return single[1];
  const matches = [...cleaned.matchAll(/\b(0x[a-fA-F0-9]{40})\b/gi)];
  if (matches.length > 0) return matches[0][1];
  return noSpace;
}

/** Read support WhatsApp + receiver wallet from DB (raw SQL so it works even if Prisma client lags schema). */
export async function readWhatsAppAndReceiverFromDb(db: PrismaClient): Promise<{
  whatsapp: string;
  receiverWalletAddress: string;
}> {
  await migrateLegacyReceiverWalletColumn(db);
  type Row = {
    whatsapp?: string | null;
    receiverWalletAddress?: string | null;
    receiverwalletaddress?: string | null;
  };
  let rows: Row[] = [];
  try {
    rows = (await db.$queryRawUnsafe(
      `SELECT "whatsapp", "receiverWalletAddress" FROM "Setting" WHERE "key" = $1 LIMIT 1`,
      MLM_SETTINGS_KEY,
    )) as Row[];
  } catch {
    try {
      rows = (await db.$queryRawUnsafe(
        `SELECT whatsapp, receiverWalletAddress FROM Setting WHERE key = $1 LIMIT 1`,
        MLM_SETTINGS_KEY,
      )) as Row[];
    } catch {
      return { whatsapp: "", receiverWalletAddress: "" };
    }
  }
  const row = rows[0];
  if (!row) return { whatsapp: "", receiverWalletAddress: "" };
  const w = String(row.whatsapp ?? "");
  const rawRecv = row.receiverWalletAddress ?? row.receiverwalletaddress ?? "";
  const receiverWalletAddress = rawRecv ? normalizeBep20AddressInput(String(rawRecv)) : "";
  return { whatsapp: w, receiverWalletAddress };
}

/** Raw SQL without quotes targeted PostgreSQL's `receiverwalletaddress` column; Prisma maps `"receiverWalletAddress"`. */
export async function migrateLegacyReceiverWalletColumn(db: PrismaClient) {
  try {
    await db.$executeRawUnsafe(
      `UPDATE "Setting" SET "receiverWalletAddress" = TRIM(receiverwalletaddress::text) WHERE "key" = $1 AND TRIM(COALESCE("receiverWalletAddress"::text, '')) = '' AND TRIM(COALESCE(receiverwalletaddress::text, '')) <> ''`,
      MLM_SETTINGS_KEY,
    );
  } catch {
    /* legacy column absent */
  }
}

/** Persist settings fields via raw SQL (avoids Prisma WASM / client drift on optional columns). */
export async function writeWhatsAppAndReceiverToDb(
  db: PrismaClient,
  opts: { whatsapp?: string; receiverWalletAddress?: string | null },
) {
  if (opts.whatsapp !== undefined) {
    try {
      await db.$executeRawUnsafe(
        `UPDATE "Setting" SET "whatsapp" = $1 WHERE "key" = $2`,
        opts.whatsapp,
        MLM_SETTINGS_KEY,
      );
    } catch {
      await db.$executeRawUnsafe(
        `UPDATE Setting SET whatsapp = $1 WHERE key = $2`,
        opts.whatsapp,
        MLM_SETTINGS_KEY,
      );
    }
  }
  if (opts.receiverWalletAddress !== undefined) {
    const v = opts.receiverWalletAddress;
    await db.$executeRawUnsafe(
      `UPDATE "Setting" SET "receiverWalletAddress" = $1 WHERE "key" = $2`,
      v,
      MLM_SETTINGS_KEY,
    );
    try {
      await db.$executeRawUnsafe(
        `UPDATE Setting SET receiverWalletAddress = $1 WHERE key = $2`,
        v,
        MLM_SETTINGS_KEY,
      );
    } catch {
      /* legacy lowercase column absent */
    }
  }
}

export async function getReceiverWalletAddress() {
  const db = getDb();
  try {
    const { receiverWalletAddress } = await readWhatsAppAndReceiverFromDb(db);
    const value = normalizeBep20AddressInput(receiverWalletAddress);
    return BEP20_HEX.test(value) ? value : DEFAULT_RECEIVER_WALLET_ADDRESS;
  } catch {
    return DEFAULT_RECEIVER_WALLET_ADDRESS;
  }
}

export async function getNormalizedReceiverWalletAddress() {
  return (await getReceiverWalletAddress()).toLowerCase();
}

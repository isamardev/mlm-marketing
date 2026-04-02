import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireAdminSection } from "@/lib/admin-api-guard";
import { Prisma } from "@prisma/client";
import { runFixedPayoutEngine } from "@/lib/mlm-logic";

const schema = z.object({
  sourceUserId: z.string().min(10),
  txHash: z.string().min(20),
  amount: z.number().positive(),
  chain: z.enum(["BSC"]).default("BSC"),
});

async function verifyOnBscScan(txHash: string) {
  const key = process.env.BSCSCAN_API_KEY;
  if (!key) return { verified: false, raw: null };
  const url = `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${encodeURIComponent(txHash)}&apikey=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { verified: false, raw: null };
  const json = (await res.json()) as unknown;
  const ok = typeof json === "object" && json !== null && "result" in json && (json as any).result;
  return { verified: Boolean(ok), raw: json };
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdminSection("payouts");
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const txHash = parsed.data.txHash.trim();

    const existing = await db.deposit.findUnique({ where: { txHash } });
    if (existing?.status === "confirmed") {
      return NextResponse.json({ error: "Duplicate txHash" }, { status: 409 });
    }

    const created = await db.deposit.upsert({
      where: { txHash },
      create: {
        userId: parsed.data.sourceUserId,
        txHash,
        amount: new Prisma.Decimal(parsed.data.amount.toFixed(2)),
        chain: parsed.data.chain,
        status: "pending",
      },
      update: {
        userId: parsed.data.sourceUserId,
        amount: new Prisma.Decimal(parsed.data.amount.toFixed(2)),
        chain: parsed.data.chain,
        status: existing?.status === "rejected" ? "pending" : existing?.status ?? "pending",
      },
    });

    const verify = await verifyOnBscScan(txHash);
    if (!verify.verified && process.env.BSCSCAN_API_KEY) {
      await db.deposit.update({ where: { id: created.id }, data: { status: "rejected" } });
      return NextResponse.json({ error: "Hash not verified on BscScan" }, { status: 400 });
    }

    const payout = await runFixedPayoutEngine({
      sourceUserId: parsed.data.sourceUserId,
      depositAmount: parsed.data.amount,
      note: `Deposit hash ${txHash}`,
    });

    await db.deposit.update({
      where: { id: created.id },
      data: { status: "confirmed", verifiedAt: new Date() },
    });

    return NextResponse.json({ success: true, deposit: { id: created.id, txHash, status: "confirmed" }, payout, bscScan: verify.raw });
  } catch {
    return NextResponse.json({ error: "Verify hash failed" }, { status: 500 });
  }
}

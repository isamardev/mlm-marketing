import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem } from "viem";
import { bsc } from "viem/chains";
import { USDT_BEP20_ADDRESS } from "@/lib/web3Actions";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ADMIN_WALLET_ADDRESS as ADMIN_FALLBACK } from "@/lib/admin";
import { runFixedPayoutEngine } from "@/lib/mlm-logic";
import { formatUnits } from "viem";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userIdFilter = url.searchParams.get("userId") || "";
    const lookbackBlocks = Number(url.searchParams.get("lookback") || 500);

    const envAdmin = String(process.env.ADMIN_WALLET_ADDRESS || "").toLowerCase();
    const fallbackAdmin = String(ADMIN_FALLBACK || "").toLowerCase();
    const ADMIN_WALLET_ADDRESS = (/^0x[a-fA-F0-9]{40}$/.test(envAdmin) ? envAdmin : fallbackAdmin);
    if (!ADMIN_WALLET_ADDRESS || !/^0x[a-fA-F0-9]{40}$/.test(ADMIN_WALLET_ADDRESS)) {
      return NextResponse.json({ error: "Admin wallet not configured" }, { status: 500 });
    }

    const client = createPublicClient({ chain: bsc, transport: http() });
    const latest = await client.getBlockNumber();
    const fromBlock = latest > BigInt(lookbackBlocks) ? latest - BigInt(lookbackBlocks) : BigInt(0);
    const toBlock = latest;

    const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

    const logs = await client.getLogs({
      address: USDT_BEP20_ADDRESS,
      fromBlock,
      toBlock,
      event: transferEvent,
      args: { to: ADMIN_WALLET_ADDRESS as `0x${string}` },
    } as any);

    const db = getDb();
    let createdCount = 0;
    let createdForUser = 0;

    // get decimals once
    let decimals = 18;
    try {
      const d = await client.readContract({
        address: USDT_BEP20_ADDRESS as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "decimals",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "decimals", type: "uint8" }],
          },
        ],
        functionName: "decimals",
      });
      decimals = Number(d || 18);
    } catch {}

    for (const lg of logs) {
      const txHash = lg.transactionHash;
      if (!txHash) continue;

      const exists = await db.deposit.findUnique({ where: { txHash } });
      if (exists) continue;

      const from = (lg.args?.from || "").toLowerCase();
      const to = (lg.args?.to || "").toLowerCase();
      if (to !== ADMIN_WALLET_ADDRESS) continue;

      const value = lg.args?.value as bigint;
      const amountNum = Number(formatUnits(value, decimals));
      if (!Number.isFinite(amountNum) || amountNum < 10) continue;

      const user = await db.user.findFirst({
        where: { walletAddress: from as string },
        select: { id: true },
      });
      if (!user) continue;

      await db.deposit.create({
        data: {
          userId: user.id,
          chain: "BSC",
          txHash,
          amount: new Prisma.Decimal(amountNum.toFixed(2)),
          status: "confirmed",
          verifiedAt: new Date(),
        },
      });
      await runFixedPayoutEngine({
        sourceUserId: user.id,
        depositAmount: amountNum,
        note: `Auto-detected deposit ${txHash}`,
      });
      createdCount += 1;
      if (userIdFilter && user.id === userIdFilter) {
        createdForUser += 1;
      }
    }

    return NextResponse.json({ success: true, created: createdCount, createdForUser });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Scan failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

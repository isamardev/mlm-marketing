import { NextResponse } from "next/server";
import { createPublicClient, http, decodeEventLog, parseAbiItem } from "viem";
import { bsc } from "viem/chains";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { runFixedPayoutEngine } from "@/lib/mlm-logic";
import { USDT_BEP20_ADDRESS } from "@/lib/web3Actions";
import { parseUnits } from "viem";
import { ADMIN_WALLET_ADDRESS as ADMIN_FALLBACK } from "@/lib/admin";
 
 export async function POST(req: Request) {
   try {
     const body = await req.json();
     const transactionHash = String(body?.transactionHash || "");
     const amount = Number(body?.amount || 0);
     const userId = String(body?.userId || "");
 
     if (!transactionHash || !amount || !userId) {
       return NextResponse.json({ error: "transactionHash, amount, userId required" }, { status: 400 });
     }
 
    const envAdmin = String(process.env.ADMIN_WALLET_ADDRESS || "").toLowerCase();
    const fallbackAdmin = String(ADMIN_FALLBACK || "").toLowerCase();
    const ADMIN_WALLET_ADDRESS = (/^0x[a-fA-F0-9]{40}$/.test(envAdmin) ? envAdmin : fallbackAdmin);
    if (!ADMIN_WALLET_ADDRESS || !/^0x[a-fA-F0-9]{40}$/.test(ADMIN_WALLET_ADDRESS)) {
      return NextResponse.json({ error: "Admin wallet not configured" }, { status: 500 });
    }
 
     const client = createPublicClient({
       chain: bsc,
       transport: http(),
     });
 
    const receipt = await client.getTransactionReceipt({ hash: transactionHash as `0x${string}` });
     if (!receipt || receipt.status !== "success") {
       return NextResponse.json({ error: "Transaction not successful" }, { status: 400 });
     }
    if (amount < 10) {
      return NextResponse.json({ error: "Minimum deposit is 10" }, { status: 400 });
    }
 
     // Ensure interacting with expected USDT contract
     const toContract = (receipt.to || "").toLowerCase();
     if (toContract !== USDT_BEP20_ADDRESS.toLowerCase()) {
       return NextResponse.json({ error: "Unexpected contract address" }, { status: 400 });
     }
 
     // Decode Transfer event to verify recipient and amount
     const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
     let matchedLog:
       | {
           from: `0x${string}`;
           to: `0x${string}`;
           value: bigint;
         }
       | null = null;
 
     for (const log of receipt.logs) {
       if ((log.address || "").toLowerCase() !== USDT_BEP20_ADDRESS.toLowerCase()) continue;
       try {
         const decoded = decodeEventLog({
           abi: [transferEvent],
           data: log.data,
           topics: log.topics,
         });
         if (decoded.eventName === "Transfer") {
           const args = decoded.args as { from: `0x${string}`; to: `0x${string}`; value: bigint };
           if ((args.to || "").toLowerCase() === ADMIN_WALLET_ADDRESS) {
             matchedLog = args;
             break;
           }
         }
       } catch {
         // skip undecodable logs
       }
     }
 
     if (!matchedLog) {
       return NextResponse.json({ error: "Recipient mismatch" }, { status: 400 });
     }
 
     // USDT on BSC commonly uses 18 decimals; fetch decimals defensively
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
     } catch {
       // keep default
     }
 
     const expected = parseUnits(String(amount), decimals);
     if (matchedLog.value !== expected) {
       return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
     }
 
    const db = getDb();
    // Double-spend protection using Deposit unique txHash
    const existing = await db.deposit.findUnique({ where: { txHash: transactionHash } });
    if (existing && existing.status === "confirmed") {
      return NextResponse.json({ error: "Transaction already processed" }, { status: 409 });
    }
    const created = existing
      ? await db.deposit.update({
          where: { id: existing.id },
          data: { amount: new Prisma.Decimal(amount.toFixed(2)), status: "pending" },
        })
      : await db.deposit.create({
          data: {
            userId,
            chain: "BSC",
            txHash: transactionHash,
            amount: new Prisma.Decimal(amount.toFixed(2)),
            status: "pending",
          },
          select: { id: true },
        });
    // Increment user balance
    await db.user.update({
      where: { id: userId },
      data: { balance: { increment: new Prisma.Decimal(amount.toFixed(2)) } },
    });
 
     // Trigger commission distribution
     const payout = await runFixedPayoutEngine({
       sourceUserId: userId,
       depositAmount: amount,
       note: `Deposit hash ${transactionHash}`,
     });
 
    await db.deposit.update({
      where: { txHash: transactionHash },
      data: { status: "confirmed", verifiedAt: new Date() },
    });

    return NextResponse.json({ success: true, payout });
   } catch (error) {
     const message = error instanceof Error ? error.message : "Verification failed";
     return NextResponse.json({ error: message }, { status: 500 });
   }
 }

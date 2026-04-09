import { Prisma } from "@prisma/client";
import { createPublicClient, decodeEventLog, formatUnits, http, parseAbiItem } from "viem";
import { bsc } from "viem/chains";
import { getDb } from "@/lib/db";
import { runFixedPayoutEngineWithTx } from "@/lib/mlm-logic";
import { getNormalizedReceiverWalletAddress } from "@/lib/receiver-wallet";
import { USDT_BEP20_ADDRESS } from "@/lib/web3Actions";

const MIN_REAL_DEPOSIT_USDT = 10;
export const INVALID_DEPOSIT_TX_MESSAGE = "Please enter valid TX ID.";

type DbTx = Parameters<Parameters<ReturnType<typeof getDb>["$transaction"]>[0]>[0];

export class DepositVerificationError extends Error {
  constructor(
    public readonly code: "INVALID_TX" | "DUPLICATE_TX" | "RECEIVER_NOT_CONFIGURED",
    message: string,
  ) {
    super(message);
  }
}

async function ensureUsdtBalanceColumn(tx: DbTx) {
  try {
    await tx.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "usdtBalance" DECIMAL(18,2) DEFAULT 0`);
  } catch {
    /* ignore */
  }
}

export async function verifyUsdtDepositTransaction(transactionHash: string) {
  const txHash = transactionHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new DepositVerificationError("INVALID_TX", INVALID_DEPOSIT_TX_MESSAGE);
  }

  const receiverWalletAddress = await getNormalizedReceiverWalletAddress();
  if (!/^0x[a-fA-F0-9]{40}$/.test(receiverWalletAddress)) {
    throw new DepositVerificationError("RECEIVER_NOT_CONFIGURED", "Receiver wallet not configured");
  }

  const client = createPublicClient({
    chain: bsc,
    transport: http(),
  });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch {
    throw new DepositVerificationError("INVALID_TX", INVALID_DEPOSIT_TX_MESSAGE);
  }

  if (!receipt || receipt.status !== "success") {
    throw new DepositVerificationError("INVALID_TX", INVALID_DEPOSIT_TX_MESSAGE);
  }

  if ((receipt.to || "").toLowerCase() !== USDT_BEP20_ADDRESS.toLowerCase()) {
    throw new DepositVerificationError("INVALID_TX", INVALID_DEPOSIT_TX_MESSAGE);
  }

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
      if (decoded.eventName !== "Transfer") continue;
      const args = decoded.args as { from: `0x${string}`; to: `0x${string}`; value: bigint };
      if ((args.to || "").toLowerCase() === receiverWalletAddress) {
        matchedLog = args;
        break;
      }
    } catch {
      /* skip undecodable logs */
    }
  }

  if (!matchedLog) {
    throw new DepositVerificationError("INVALID_TX", INVALID_DEPOSIT_TX_MESSAGE);
  }

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
    /* keep default */
  }

  const amountRaw = Number(formatUnits(matchedLog.value, decimals));
  const amount = Number(amountRaw.toFixed(2));
  if (!Number.isFinite(amount) || amount < MIN_REAL_DEPOSIT_USDT) {
    throw new DepositVerificationError("INVALID_TX", INVALID_DEPOSIT_TX_MESSAGE);
  }

  return {
    txHash,
    amount,
    senderAddress: (matchedLog.from || "").toLowerCase(),
    receiverWalletAddress,
  };
}

export async function finalizeVerifiedDeposit(params: {
  userId: string;
  txHash: string;
  amount: number;
  note?: string;
}) {
  const db = getDb();
  const txHash = params.txHash.trim();
  const amount = Number(params.amount.toFixed(2));

  return db.$transaction(async (tx) => {
    const existing = await tx.deposit.findUnique({ where: { txHash } });
    if (existing?.status === "confirmed" || (existing && existing.userId !== params.userId)) {
      throw new DepositVerificationError("DUPLICATE_TX", INVALID_DEPOSIT_TX_MESSAGE);
    }

    await ensureUsdtBalanceColumn(tx);

    try {
      await tx.user.update({
        where: { id: params.userId },
        data: { usdtBalance: { increment: new Prisma.Decimal(amount.toFixed(2)) } } as any,
      });
    } catch {
      await tx.$executeRawUnsafe(
        `UPDATE "User" SET "usdtBalance" = COALESCE("usdtBalance", 0) + $1 WHERE id = $2`,
        amount,
        params.userId,
      );
    }

    const deposit = existing
      ? await tx.deposit.update({
          where: { id: existing.id },
          data: {
            userId: params.userId,
            chain: "BSC",
            amount: new Prisma.Decimal(amount.toFixed(2)),
            status: "confirmed",
            verifiedAt: new Date(),
          },
        })
      : await tx.deposit.create({
          data: {
            userId: params.userId,
            chain: "BSC",
            txHash,
            amount: new Prisma.Decimal(amount.toFixed(2)),
            status: "confirmed",
            verifiedAt: new Date(),
          },
        });

    const payout = await runFixedPayoutEngineWithTx(tx, {
      sourceUserId: params.userId,
      depositAmount: amount,
      note: params.note ?? `Deposit hash ${txHash}`,
    });

    return { deposit, payout };
  });
}

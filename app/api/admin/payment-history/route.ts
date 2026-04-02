import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminSection } from "@/lib/admin-api-guard";
import { Prisma } from "@prisma/client";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();

const TYPES = ["deposits", "withdrawals", "commissions", "charity", "fee"] as const;
type HistoryType = (typeof TYPES)[number];

export async function GET(req: Request) {
  try {
    const gate = await requireAdminSection("payments");
    if (!gate.ok) return gate.response;

    const url = new URL(req.url);
    const raw = (url.searchParams.get("type") || "deposits").toLowerCase();
    const type = (TYPES.includes(raw as HistoryType) ? raw : "deposits") as HistoryType;
    const take = Math.min(500, Math.max(20, Number(url.searchParams.get("take") ?? 200)));

    const db = getDb();

    if (type === "deposits") {
      const items = await db.deposit.findMany({
        orderBy: { createdAt: "desc" },
        take,
        include: {
          user: { select: { id: true, username: true, email: true, walletAddress: true } },
        },
      });
      return NextResponse.json({
        type,
        items: items.map((d) => ({
          id: d.id,
          at: d.createdAt.toISOString(),
          user: d.user,
          amount: Number(d.amount),
          status: d.status,
          txHash: d.txHash,
          chain: d.chain,
          verifiedAt: d.verifiedAt?.toISOString() ?? null,
        })),
      });
    }

    if (type === "withdrawals") {
      const items = await db.withdrawal.findMany({
        orderBy: { createdAt: "desc" },
        take,
        include: {
          user: { select: { id: true, username: true, email: true, walletAddress: true } },
        },
      });
      return NextResponse.json({
        type,
        items: items.map((w) => ({
          id: w.id,
          at: w.createdAt.toISOString(),
          user: w.user,
          netPayout: Number(w.amount),
          status: w.status,
          address: w.address,
          txHash: w.txHash,
          grossRequested: w.grossRequested != null ? Number(w.grossRequested) : null,
          feeAmount: w.feeAmount != null ? Number(w.feeAmount) : null,
          charityAmount: w.charityAmount != null ? Number(w.charityAmount) : null,
          feePoolAmount: w.feePoolAmount != null ? Number(w.feePoolAmount) : null,
        })),
      });
    }

    if (type === "commissions") {
      const adminUsers = await db.user.findMany({
        where: {
          OR: [{ status: "admin" }, { email: { equals: ADMIN_EMAIL, mode: "insensitive" } }],
        },
        select: { id: true },
      });
      const adminIds = [...new Set(adminUsers.map((u) => u.id))];

      if (adminIds.length === 0) {
        return NextResponse.json({ type, items: [] });
      }

      const items = await db.transaction.findMany({
        where: {
          type: "commission",
          userId: { in: adminIds },
        },
        orderBy: { createdAt: "desc" },
        take,
        include: {
          user: { select: { id: true, username: true, email: true, walletAddress: true } },
          sourceUser: { select: { id: true, username: true, email: true, walletAddress: true } },
        },
      });

      // Same activation often creates multiple commission rows to admin (e.g. L1 + L0 remainder) in the same second — show one row.
      type Raw = {
        id: string;
        at: string;
        sourceUserId: string;
        fromUser: { id: string; username: string; email: string; walletAddress: string };
        level: number;
        amount: number;
        note: string;
      };
      const raw: Raw[] = items.map((t) => ({
        id: t.id,
        at: t.createdAt.toISOString(),
        sourceUserId: t.sourceUserId,
        fromUser: t.sourceUser,
        level: t.level,
        amount: Number(t.amount),
        note: t.note,
      }));

      // Cluster rows: same source user + created within a few seconds (same activation / payout batch)
      const WINDOW_MS = 4000;
      const sortedAsc = [...raw].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      const clusters: Raw[][] = [];
      let cur: Raw[] = [];
      for (const t of sortedAsc) {
        if (cur.length === 0) {
          cur.push(t);
          continue;
        }
        const last = cur[cur.length - 1];
        const sameSource = last.sourceUserId === t.sourceUserId;
        const dt = new Date(t.at).getTime() - new Date(last.at).getTime();
        if (sameSource && dt >= 0 && dt <= WINDOW_MS) {
          cur.push(t);
        } else {
          clusters.push(cur);
          cur = [t];
        }
      }
      if (cur.length) clusters.push(cur);

      const merged = clusters.map((arr) => {
        const total = Number(arr.reduce((s, x) => s + x.amount, 0).toFixed(2));
        const sorted = [...arr].sort((a, b) => a.level - b.level);
        const breakdown = sorted.map((x) => `L${x.level}: $${x.amount.toFixed(2)}`).join(" · ");
        const noteJoined = [...new Set(arr.map((x) => x.note).filter(Boolean))].join(" · ");
        const first = arr[0];
        const lastAt = arr[arr.length - 1].at;
        return {
          id: arr.length > 1 ? `merged:${first.sourceUserId}:${first.at}` : first.id,
          at: lastAt,
          fromUser: first.fromUser,
          amount: total,
          breakdown,
          note: noteJoined,
        };
      });
      merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      return NextResponse.json({ type, items: merged });
    }

    if (type === "charity") {
      const items = await db.withdrawal.findMany({
        where: {
          charityAmount: { gt: new Prisma.Decimal(0) },
        },
        orderBy: { createdAt: "desc" },
        take,
        include: {
          user: { select: { id: true, username: true, email: true, walletAddress: true } },
        },
      });
      return NextResponse.json({
        type,
        items: items.map((w) => ({
          id: w.id,
          at: w.createdAt.toISOString(),
          user: w.user,
          amount: Number(w.charityAmount ?? 0),
          grossRequested: w.grossRequested != null ? Number(w.grossRequested) : null,
          feeAmount: w.feeAmount != null ? Number(w.feeAmount) : null,
          withdrawalStatus: w.status,
          netPayout: Number(w.amount),
        })),
      });
    }

    // fee pool history (90% of withdrawal fee)
    const items = await db.withdrawal.findMany({
      where: {
        feePoolAmount: { gt: new Prisma.Decimal(0) },
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: { select: { id: true, username: true, email: true, walletAddress: true } },
      },
    });
    return NextResponse.json({
      type: "fee",
      items: items.map((w) => ({
        id: w.id,
        at: w.createdAt.toISOString(),
        user: w.user,
        amount: Number(w.feePoolAmount ?? 0),
        grossRequested: w.grossRequested != null ? Number(w.grossRequested) : null,
        feeAmount: w.feeAmount != null ? Number(w.feeAmount) : null,
        charityAmount: w.charityAmount != null ? Number(w.charityAmount) : null,
        withdrawalStatus: w.status,
        netPayout: Number(w.amount),
      })),
    });
  } catch (e) {
    console.error("payment-history GET", e);
    return NextResponse.json({ error: "Failed to load payment history" }, { status: 500 });
  }
}

 import { NextResponse } from "next/server";
 import { auth } from "@/auth";
 import { getDb } from "@/lib/db";
 
 export async function GET() {
   try {
     const session = await auth();
     if (!session?.user || session.user.status !== "admin") {
       return NextResponse.json({ error: "Admin only" }, { status: 403 });
     }
     const db = getDb();
    const items = await db.withdrawal.findMany({
       where: { status: "pending" },
       orderBy: { createdAt: "desc" },
       take: 200,
      include: { user: { select: { id: true, username: true, email: true, walletAddress: true } } },
    });
     return NextResponse.json({ items });
   } catch {
     return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 });
   }
 }
 
 export async function PATCH(req: Request) {
   try {
     const session = await auth();
     if (!session?.user || session.user.status !== "admin") {
       return NextResponse.json({ error: "Admin only" }, { status: 403 });
     }
     const body = await req.json();
     const id = String(body?.id || "");
     const txHash = body?.txHash ? String(body.txHash) : undefined;
     const action = String(body?.action || "approve"); // approve | reject
     if (!id || (action === "approve" && !txHash)) {
       return NextResponse.json({ error: "Invalid request" }, { status: 400 });
     }
 
     const db = getDb();
     const w = await db.withdrawal.findUnique({ where: { id } });
     if (!w || w.status !== "pending") {
       return NextResponse.json({ error: "Withdrawal not found or already processed" }, { status: 404 });
     }
 
     if (action === "reject") {
       // Refund balance
       await db.$transaction(async (tx) => {
         await tx.user.update({
           where: { id: w.userId },
           data: { balance: { increment: w.amount } },
         });
         await tx.withdrawal.update({
           where: { id },
           data: { status: "rejected" },
         });
       });
       return NextResponse.json({ success: true, status: "rejected" });
     }
 
     await db.withdrawal.update({
       where: { id },
       data: { status: "approved", txHash },
     });
     return NextResponse.json({ success: true, status: "approved" });
   } catch {
     return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 });
   }
 }

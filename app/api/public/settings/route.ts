import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { readWhatsAppAndReceiverFromDb } from "@/lib/receiver-wallet";

export async function GET() {
  try {
    const db = getDb();
    const { whatsapp, receiverWalletAddress } = await readWhatsAppAndReceiverFromDb(db);

    return NextResponse.json({
      whatsappNumber: whatsapp || "923000000000",
      receiverWalletAddress,
    });
  } catch {
    return NextResponse.json({ whatsappNumber: "", receiverWalletAddress: "" });
  }
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getResolvedReceiverWalletAddress, readWhatsAppAndReceiverFromDb } from "@/lib/receiver-wallet";

export async function GET() {
  try {
    const db = getDb();
    const { whatsapp } = await readWhatsAppAndReceiverFromDb(db);

    return NextResponse.json({
      whatsappNumber: (whatsapp ?? "").trim(),
      receiverWalletAddress: getResolvedReceiverWalletAddress(),
    });
  } catch {
    return NextResponse.json({
      whatsappNumber: "",
      receiverWalletAddress: getResolvedReceiverWalletAddress(),
    });
  }
}

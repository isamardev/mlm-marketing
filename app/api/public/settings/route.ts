import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { MLM_SETTINGS_KEY } from "@/lib/mlm-logic";

export async function GET() {
  try {
    const db = getDb();
    
    // Fetch whatsapp manually via raw query (multiple variations)
    let whatsapp = "";
    try {
      const raw: any = await db.$queryRawUnsafe(`SELECT whatsapp FROM Setting WHERE key = $1 LIMIT 1`, MLM_SETTINGS_KEY);
      if (raw && raw[0]) whatsapp = raw[0].whatsapp || "";
    } catch {
      try {
        const raw: any = await db.$queryRawUnsafe(`SELECT "whatsapp" FROM "Setting" WHERE "key" = $1 LIMIT 1`, MLM_SETTINGS_KEY);
        if (raw && raw[0]) whatsapp = raw[0].whatsapp || "";
      } catch {}
    }

    return NextResponse.json({
      whatsappNumber: whatsapp || "923000000000",
    });
  } catch {
    return NextResponse.json({ whatsappNumber: "" });
  }
}

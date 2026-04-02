import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireAdminSection } from "@/lib/admin-api-guard";
import { DEFAULT_LEVEL_PERCENTAGES, MLM_SETTINGS_KEY } from "@/lib/mlm-logic";

const patchSchema = z.object({
  levelPercentages: z.array(z.number().min(0)).length(20).optional(),
  whatsappNumber: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const gate = await requireAdminSection("settings");
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const { whatsappNumber } = parsed.data;

    // 1. Ensure column exists (multiple attempts)
    try {
      await db.$executeRawUnsafe(`ALTER TABLE Setting ADD COLUMN whatsapp TEXT DEFAULT ''`);
    } catch {}
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "Setting" ADD COLUMN "whatsapp" TEXT DEFAULT ''`);
    } catch {}

    // 2. Safely upsert ONLY with fields Prisma client definitely knows (key, levelPercentages)
    // to ensure the record exists first.
    let setting = await db.setting.findUnique({ where: { key: MLM_SETTINGS_KEY } });
    if (!setting) {
      setting = await db.setting.create({
        data: {
          key: MLM_SETTINGS_KEY,
          levelPercentages: DEFAULT_LEVEL_PERCENTAGES,
        }
      });
    }

    // 3. Update the whatsapp field purely via raw SQL to bypass any Prisma client sync issues
    if (whatsappNumber !== undefined) {
      try {
        await db.$executeRawUnsafe(
          `UPDATE Setting SET whatsapp = $1 WHERE key = $2`,
          whatsappNumber,
          MLM_SETTINGS_KEY
        );
      } catch {
        // Try quoted table/column names for PostgreSQL
        try {
          await db.$executeRawUnsafe(
            `UPDATE "Setting" SET "whatsapp" = $1 WHERE "key" = $2`,
            whatsappNumber,
            MLM_SETTINGS_KEY
          );
        } catch (rawError) {
          console.error("Raw SQL Update failed:", rawError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      whatsappNumber: whatsappNumber,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const gate = await requireAdminSection("settings");
    if (!gate.ok) return gate.response;

    const db = getDb();
    
    // Ensure column exists
    try {
      await db.$executeRawUnsafe(`ALTER TABLE Setting ADD COLUMN whatsapp TEXT DEFAULT ''`);
    } catch {}
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "Setting" ADD COLUMN "whatsapp" TEXT DEFAULT ''`);
    } catch {}

    let setting = await db.setting.findUnique({ where: { key: MLM_SETTINGS_KEY } });
    
    if (!setting) {
      setting = await db.setting.create({ 
        data: { 
          key: MLM_SETTINGS_KEY, 
          levelPercentages: DEFAULT_LEVEL_PERCENTAGES 
        } 
      });
    }

    // Fetch whatsapp manually via raw query (multiple variations)
    let whatsapp = "";
    try {
      const raw: any = await db.$queryRawUnsafe(`SELECT whatsapp FROM Setting WHERE key = $1 LIMIT 1`, MLM_SETTINGS_KEY);
      if (raw && raw[0]) whatsapp = raw[0].whatsapp || "";
    } catch {
      try {
        const raw: any = await db.$queryRawUnsafe(`SELECT "whatsapp" FROM "Setting" WHERE "key" = $1 LIMIT 1`, MLM_SETTINGS_KEY);
        if (raw && raw[0]) whatsapp = raw[0].whatsapp || "";
      } catch (rawError) {
        console.error("GET whatsapp raw error:", rawError);
      }
    }

    return NextResponse.json({
      key: setting.key,
      levelPercentages: setting.levelPercentages,
      whatsappNumber: whatsapp,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

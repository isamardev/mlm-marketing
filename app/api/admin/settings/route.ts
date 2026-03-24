import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { DEFAULT_LEVEL_PERCENTAGES, MLM_SETTINGS_KEY } from "@/lib/mlm-logic";

const patchSchema = z.object({
  levelPercentages: z.array(z.number().min(0)).length(20),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();

    const updated = await db.setting.upsert({
      where: { key: MLM_SETTINGS_KEY },
      create: { key: MLM_SETTINGS_KEY, levelPercentages: parsed.data.levelPercentages },
      update: { levelPercentages: parsed.data.levelPercentages },
    });

    return NextResponse.json({
      success: true,
      setting: {
        key: updated.key,
        levelPercentages: updated.levelPercentages,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.status !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const db = getDb();
    const setting =
      (await db.setting.findUnique({ where: { key: MLM_SETTINGS_KEY } })) ??
      (await db.setting.create({ data: { key: MLM_SETTINGS_KEY, levelPercentages: DEFAULT_LEVEL_PERCENTAGES } }));

    return NextResponse.json({
      key: setting.key,
      levelPercentages: setting.levelPercentages,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

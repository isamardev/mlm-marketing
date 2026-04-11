"use strict";

/**
 * Runs `prisma generate` (via Node — avoids `npx` resolution delays on Windows) and copies the
 * client into `node_modules/.prisma/client` for Next/Vercel.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
const schema = path.join(root, "prisma", "schema.prisma");
const copyScript = path.join(root, "scripts", "copy-prisma-client.cjs");

function main() {
  if (!fs.existsSync(prismaCli)) {
    console.error("[prisma-setup] Missing Prisma CLI. Run: npm install");
    process.exit(1);
  }
  if (!fs.existsSync(schema)) {
    console.error("[prisma-setup] Missing schema at", schema);
    process.exit(1);
  }

  const outDir = path.join(root, "generated", "prisma-client");
  // Full delete every run was very slow on Windows + antivirus. Only wipe when explicitly requested.
  if (process.env.PRISMA_CLEAN_BEFORE_GENERATE === "1") {
    try {
      if (fs.existsSync(outDir)) {
        console.log("[prisma-setup] PRISMA_CLEAN_BEFORE_GENERATE=1 — clearing", outDir, "…");
        fs.rmSync(outDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn("[prisma-setup] Could not remove old output:", e?.message || e);
    }
  }

  const t0 = Date.now();
  console.log("[prisma-setup] Generating Prisma Client …", new Date().toISOString());
  console.log("[prisma-setup] Tip: first run may download engines (~1–3 min). Stuck >15 min? Check network / antivirus.");
  const gen = spawnSync(
    process.execPath,
    [prismaCli, "generate", "--no-hints", "--schema", schema],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        CI: process.env.CI || "1",
      },
    },
  );
  if (gen.status !== 0) {
    process.exit(gen.status ?? 1);
  }
  console.log("[prisma-setup] generate done in", Math.round((Date.now() - t0) / 1000), "s");

  const copy = spawnSync(process.execPath, [copyScript], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (copy.status !== 0) {
    process.exit(copy.status ?? 1);
  }
}

main();

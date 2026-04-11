"use strict";

/**
 * Full production build with visible steps (easier to see where Windows "hangs").
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const prismaSetup = path.join(root, "scripts", "prisma-setup.cjs");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

/**
 * Skip `prisma generate` when client already exists and is at least as new as schema.prisma.
 * Saves long Windows stalls (engine download / AV). Vercel still OK: postinstall generates first.
 * Override: FORCE_PRISMA_SETUP=1 or edit schema then build.
 */
function shouldSkipPrismaSetup() {
  if (process.env.FORCE_PRISMA_SETUP === "1") return false;
  const schemaPath = path.join(root, "prisma", "schema.prisma");
  const genIndex = path.join(root, "generated", "prisma-client", "index.js");
  const nmIndex = path.join(root, "node_modules", ".prisma", "client", "index.js");
  if (!fs.existsSync(schemaPath) || !fs.existsSync(genIndex) || !fs.existsSync(nmIndex)) {
    return false;
  }
  try {
    const schemaM = fs.statSync(schemaPath).mtimeMs;
    const genM = fs.statSync(genIndex).mtimeMs;
    return genM >= schemaM;
  } catch {
    return false;
  }
}

function run(title, execPath, args) {
  console.log("\n[build]", title, "…\n");
  const r = spawnSync(execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CI: process.env.CI || "1" },
  });
  if (r.status !== 0) {
    console.error("\n[build] FAILED at:", title);
    process.exit(r.status ?? 1);
  }
}

function main() {
  if (!fs.existsSync(prismaSetup)) {
    console.error("[build] Missing scripts/prisma-setup.cjs");
    process.exit(1);
  }
  if (process.env.SKIP_PRISMA_SETUP === "1") {
    console.log(
      "\n[build] SKIP_PRISMA_SETUP=1 — skipping Prisma (client must exist from a prior `npm run db:generate`).\n",
    );
  } else if (shouldSkipPrismaSetup()) {
    console.log(
      "\n[build] Prisma generate skipped — client already matches schema.prisma (fast path).",
      "To force regenerate: npm run db:generate  or  set FORCE_PRISMA_SETUP=1\n",
    );
  } else {
    run("Prisma setup (generate + copy)", process.execPath, [prismaSetup]);
  }

  const copyLogo = path.join(root, "scripts", "copy-brand-logo.cjs");
  if (fs.existsSync(copyLogo)) {
    run("Brand logo → public + app/icon", process.execPath, [copyLogo]);
  }

  if (!fs.existsSync(nextBin)) {
    console.error("[build] Missing Next.js. Run: npm install");
    process.exit(1);
  }
  run("Next.js webpack build", process.execPath, [nextBin, "build", "--webpack"]);
  console.log("\n[build] Done.\n");
}

main();

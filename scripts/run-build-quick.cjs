"use strict";
/**
 * Same as `npm run build` but skips Prisma — use when `generated/prisma-client` is already up to date
 * (e.g. after `npm run db:generate` or successful `npm install`). Saves several minutes on Windows.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
process.env.SKIP_PRISMA_SETUP = "1";
const r = spawnSync(process.execPath, [path.join(__dirname, "run-build.cjs")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, SKIP_PRISMA_SETUP: "1" },
});
process.exit(r.status ?? 1);

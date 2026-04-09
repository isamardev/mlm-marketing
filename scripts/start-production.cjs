"use strict";

/**
 * `next start` requires a prior `next build`. If `.next/BUILD_ID` is missing, run the full
 * `npm run build` (Prisma + link + webpack) once, then start. Override with SKIP_START_BUILD=1
 * and use `start:only` when the image already contains `.next`.
 */
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const root = process.cwd();
const buildIdPath = path.join(root, ".next", "BUILD_ID");
const nextPkgDir = path.dirname(require.resolve("next/package.json"));
const nextBin = path.join(nextPkgDir, "dist", "bin", "next");

function main() {
  if (!fs.existsSync(buildIdPath) && process.env.SKIP_START_BUILD !== "1") {
    console.log("[start] No production build (.next/BUILD_ID). Running npm run build …\n");
    execSync("npm run build", {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
    if (!fs.existsSync(buildIdPath)) {
      console.error("[start] Build finished but .next/BUILD_ID is still missing.");
      process.exit(1);
    }
  }

  const passThrough = process.argv.slice(2);
  const result = spawnSync(process.execPath, [nextBin, "start", ...passThrough], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

main();

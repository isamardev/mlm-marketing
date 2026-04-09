"use strict";

/**
 * Prisma `output` is outside `node_modules` so `prisma generate` does not unlink
 * locked files under `node_modules/.prisma/client`. This script points
 * `node_modules/.prisma/client` at the generated folder so `@prisma/client` keeps working.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const generated = path.join(root, "generated", "prisma-client");
const prismaDir = path.join(root, "node_modules", ".prisma");
const linkPath = path.join(prismaDir, "client");

function main() {
  if (!fs.existsSync(generated)) {
    console.error("link-prisma-client: missing", generated, "— run npx prisma generate first.");
    process.exit(1);
  }

  fs.mkdirSync(prismaDir, { recursive: true });

  if (fs.existsSync(linkPath)) {
    try {
      fs.rmSync(linkPath, { recursive: true, force: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        "link-prisma-client: could not remove",
        linkPath,
        "\nClose the dev server and any process using Prisma, then retry.\n",
        msg,
      );
      process.exit(1);
    }
  }

  if (process.platform === "win32") {
    fs.symlinkSync(generated, linkPath, "junction");
  } else {
    fs.symlinkSync(generated, linkPath, "dir");
  }
}

main();

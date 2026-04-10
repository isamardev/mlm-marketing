"use strict";

/**
 * Symlinks from `generated/prisma-client` → `node_modules/.prisma/client` break on Vercel
 * (`Cannot find module '.prisma/client/default'`). Copy real files instead.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "generated", "prisma-client");
const dest = path.join(root, "node_modules", ".prisma", "client");

function main() {
  if (!fs.existsSync(src)) {
    console.error("copy-prisma-client: missing", src, "— run npx prisma generate first.");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log("copy-prisma-client: copied to", dest);
}

main();

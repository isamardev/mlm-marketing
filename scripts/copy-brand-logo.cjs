/**
 * Copies repo-root logo.jpeg → public/logo.jpeg and app/icon.jpeg (tab icon / metadata).
 * Invoked from postinstall + run-build; safe if logo.jpeg is missing (warn only).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "logo.jpeg");
const dstPublic = path.join(root, "public", "logo.jpeg");
const dstIcon = path.join(root, "app", "icon.jpeg");

function main() {
  if (!fs.existsSync(src)) {
    console.warn("[copy-brand-logo] No logo.jpeg at repo root — skipped.");
    return;
  }
  try {
    fs.mkdirSync(path.dirname(dstPublic), { recursive: true });
    fs.mkdirSync(path.dirname(dstIcon), { recursive: true });
    fs.copyFileSync(src, dstPublic);
    fs.copyFileSync(src, dstIcon);
    console.log("[copy-brand-logo] OK → public/logo.jpeg, app/icon.jpeg");
  } catch (e) {
    console.warn("[copy-brand-logo] Copy failed:", e instanceof Error ? e.message : e);
  }
}

main();

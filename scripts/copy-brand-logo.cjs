/**
 * Copies brand logo → public/logo.jpeg and app/icon.jpeg (favicon).
 * Sources tried: ./logo.jpeg, ./logo.jpg, ./public/logo.jpeg (first file wins).
 * Uses read/write instead of copyFileSync (fewer Windows ENOENT quirks).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dstPublic = path.join(root, "public", "logo.jpeg");
const dstIcon = path.join(root, "app", "icon.jpeg");

function findSource() {
  const candidates = [
    path.join(root, "logo.jpeg"),
    path.join(root, "logo.jpg"),
    path.join(root, "public", "logo.jpeg"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const st = fs.statSync(p);
      if (st.isFile()) return path.resolve(p);
    } catch {
      /* next */
    }
  }
  return null;
}

function writeBytes(fromAbs, toAbs) {
  fs.mkdirSync(path.dirname(toAbs), { recursive: true });
  const buf = fs.readFileSync(fromAbs);
  fs.writeFileSync(toAbs, buf);
}

function main() {
  const src = findSource();
  if (!src) {
    console.warn(
      "[copy-brand-logo] No logo file — add logo.jpeg (or logo.jpg) at project root, or commit public/logo.jpeg. Skipped.",
    );
    return;
  }

  try {
    const pub = path.resolve(dstPublic);
    const icon = path.resolve(dstIcon);
    if (src !== pub) {
      writeBytes(src, pub);
    }
    writeBytes(src, icon);
    console.log("[copy-brand-logo] OK → public/logo.jpeg, app/icon.jpeg");
  } catch (e) {
    console.warn(
      "[copy-brand-logo] Copy failed:",
      e instanceof Error ? e.message : e,
      "— close apps locking logo files; ensure public/ is a folder; retry.",
    );
  }
}

main();

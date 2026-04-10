import type { NextConfig } from "next";
import path from "node:path";

/** Run `npm run dev` from the repo root. Pins tracing when multiple lockfiles exist up-tree. */
const projectRoot = path.resolve(process.cwd());

/**
 * Temp distDir only when `NEXT_USE_TEMP_DIST=1` (set by `npm run dev` on Windows).
 * `next build` / `next start` always use the default `.next` in the repo so they never disagree.
 * Vercel must not use a custom distDir (broken `tsconfig` includes).
 */
function distDirWindowsTempDevOnly(): string | undefined {
  if (process.env.VERCEL === "1") {
    return undefined;
  }
  if (process.env.NEXT_USE_TEMP_DIST !== "1") {
    return undefined;
  }
  if (process.platform !== "win32") {
    return undefined;
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return undefined;
  }
  const tempAbs = path.join(localAppData, "Temp", "mlm-marketing-next");
  // Must be relative to the project root. An absolute `distDir` gets joined with `cwd` inside
  // Next/webpack and becomes `repo\C:\Users\...` on Windows (ENOENT on mkdir).
  const rel = path.relative(projectRoot, tempAbs);
  if (!rel || path.isAbsolute(rel)) {
    return undefined;
  }
  return rel;
}

const distDir = distDirWindowsTempDevOnly();

/**
 * Dev-only: Next 16 blocks cross-origin requests to `/_next/*` by default (security).
 * Include hostname-only + full origin — some Next versions match one or the other.
 * LAN testing: set `ALLOWED_DEV_ORIGINS=http://192.168.1.10:3000` in `.env.local`.
 */
const allowedDevOrigins = [
  "localhost",
  "127.0.0.1",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000",
  ...(process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins,
  /** Prisma + Neon serverless adapter (ws) — keep external for correct runtime resolution on Vercel. */
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "ws",
  ],
  ...(distDir ? { distDir } : {}),
  outputFileTracingRoot: projectRoot,
  /** Polling helps file watchers on Windows (slow/locked drives, Defender). */
  watchOptions: {
    pollIntervalMs: 1000,
  },
  experimental: {
    /**
     * The ⨯ in the dev console only means these flags are off — not errors.
     * They are Windows/local workarounds; Vercel production does not use `next dev` or these dev toggles.
     */
    /** Windows: `<distDir>/lock` acquisition can fail with ENOENT; skip when a single dev instance is used. */
    lockDistDir: false,
    /**
     * Next 16 defaults this on; the MCP dev endpoint can hang startup on some Windows setups
     * (console stuck after "✓ Starting...", HTTP never accepts).
     */
    mcpServer: false,
    /** Use `.next` for dev without `/dev` subfolder — fewer EPERM unlink errors on Windows. */
    isolatedDevBuild: false,
  },
  /** `npm run dev` uses webpack — silence optional wallet SDK deps that slow resolution */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@react-native-async-storage/async-storage": false,
        "pino-pretty": false,
      };
    }
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";

/** Run `npm run dev` from the repo root. Pins tracing when multiple lockfiles exist up-tree. */
const projectRoot = path.resolve(process.cwd());

/**
 * Custom distDir only for local Windows dev. Vercel/CI must use `.next` or Next injects broken
 * `tsconfig` include paths (and TypeScript fails on `next/dist/lib/metadata/...`).
 */
function distDirLocalWindowsOnly(): string | undefined {
  if (process.env.VERCEL === "1" || Boolean(process.env.CI)) {
    return undefined;
  }
  if (process.platform !== "win32") {
    return undefined;
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return undefined;
  }
  return path.join(localAppData, "Temp", "mlm-marketing-next");
}

const distDir = distDirLocalWindowsOnly();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Windows local dev: build under Local\\Temp; Vercel uses default `.next`. */
  ...(distDir ? { distDir } : {}),
  outputFileTracingRoot: projectRoot,
  /** Polling helps file watchers on Windows (slow/locked drives, Defender). */
  watchOptions: {
    pollIntervalMs: 1000,
  },
  experimental: {
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

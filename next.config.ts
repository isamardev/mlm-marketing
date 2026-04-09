import type { NextConfig } from "next";
import path from "node:path";

/** Run `npm run dev` from the repo root. Pins tracing when multiple lockfiles exist up-tree. */
const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Windows workaround: this machine's Node runtime can't create files inside the repo reliably. */
  /** Server bundles load from here; `scripts/set-node-path.cjs` (via npm scripts) so `react` resolves. */
  distDir: "../../../AppData/Local/Temp/mlm-marketing-next",
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

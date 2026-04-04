import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Smaller dev + prod bundles: tree-shake icon packages */
  experimental: {
    optimizePackageImports: ["react-icons", "react-icons/fa"],
  },
  turbopack: {
    root: __dirname,
  },
  /** `npm run dev:webpack` only — silence optional wallet SDK deps that slow resolution */
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@assetflow/shared", "@assetflow/ui"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

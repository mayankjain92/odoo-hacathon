import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@assetflow/shared", "@assetflow/ui"],
};

export default nextConfig;

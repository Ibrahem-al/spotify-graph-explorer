import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  transpilePackages: ["@neo4j-nvl/react", "@neo4j-nvl/base"],
};

export default nextConfig;

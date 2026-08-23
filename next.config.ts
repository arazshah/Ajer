import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    useTypeScriptCli: false,
    serverActions: { bodySizeLimit: "5mb" },
  },
};
export default nextConfig;

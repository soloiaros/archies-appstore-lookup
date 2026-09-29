import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,

  serverExternalPackages: [
    "@huggingface/transformers",
    "@opennextjs/cloudflare",
    "onnxruntime-node",
    "sharp",
    "wrangler",
  ],

  async redirects() {
    return [
      {
        source: "/sponsor",
        destination: "/support",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

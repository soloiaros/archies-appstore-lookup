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
        source: "/terms-of-service",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/privacy-policy",
        destination: "/privacy",
        permanent: true,
      },
      {
        source: "/refund-policy",
        destination: "/refund",
        permanent: true,
      },
      {
        source: "/refunds",
        destination: "/refund",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;


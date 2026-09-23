import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,

  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
};

export default nextConfig;

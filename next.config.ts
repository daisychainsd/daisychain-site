import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static must stay unbundled (so its __dirname-based binary path
  // resolves at runtime) and its binary must be traced into every function
  // that spawns it — otherwise ffmpeg is missing on Vercel and conversion 500s.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/convert": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/webhooks/sanity/preview-gen": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
};

export default nextConfig;

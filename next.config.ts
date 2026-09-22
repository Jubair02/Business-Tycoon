import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output is for self-hosting, and it is wrong on Vercel: the
   * platform builds and serves the app itself, and a `.next/standalone` tree
   * only confuses that. It is opt-in rather than deleted, because running the
   * server directly is still a supported way to host this — see the
   * `build:standalone` and `start:standalone` scripts.
   */
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // `typescript.ignoreBuildErrors` was on, which let type errors ship. The
  // project currently type-checks clean, so the guard is enabled.
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

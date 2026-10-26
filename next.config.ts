import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // Only validate instant navigation on segments that opt in with `export const instant`.
    // The default validates every page on every dev request, which is slow on small machines
    // and adds little here: the signed-in app renders on the client after login.
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // "/app" has no page of its own; send it straight to the first section
  async redirects() {
    return [{ source: "/app", destination: "/app/students", permanent: false }];
  },
};

export default nextConfig;

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
  // Same-origin API: with BACKEND_URL set (and NEXT_PUBLIC_API_URL unset), the browser
  // calls /api/* on this site and it's forwarded to the backend. The login cookie then
  // belongs to this site, so phones (Safari, Brave) that block third-party cookies keep you signed in.
  async rewrites() {
    // Production builds fall back to the live API, so the proxy works even if BACKEND_URL
    // is missing on the host; `next dev` only proxies when BACKEND_URL is set.
    const fallback = process.env.NODE_ENV === "production" ? "https://eduflowbackend-1.onrender.com" : "";
    const backend = (process.env.BACKEND_URL || fallback).trim().replace(/\/+$/, "");
    return backend ? [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] : [];
  },
};

export default nextConfig;

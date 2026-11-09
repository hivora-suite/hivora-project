import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const backend = process.env.HIVORA_PROJECT_BACKEND ?? "http://127.0.0.1:8000";

// Production: static SPA served by FastAPI (no Node runtime).
// Development: `next dev` proxies the API to the backend.
const nextConfig: NextConfig = {
  ...(isDev
    ? { rewrites: async () => [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] }
    : { output: "export" }),
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;

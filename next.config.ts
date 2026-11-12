import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Embedded Postgres (PGlite) ships WASM assets that must be loaded by Node directly.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Remote previews / tunnels are a different origin than localhost during `next dev`.
  allowedDevOrigins: ["127.0.0.1", "**.e2b.app", "**.e2b.dev", "**.vercel.app", "**.ngrok-free.app", "**.trycloudflare.com"],
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;

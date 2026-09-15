import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    // Use server-side BACKEND_URL (no NEXT_PUBLIC_ prefix) so it is read at
    // server startup — not baked in at Docker build time.
    const backendRaw =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";

    const backendWithProto = backendRaw.startsWith("http")
      ? backendRaw
      : `https://${backendRaw}`;

    const cleanHost = backendWithProto.replace(/\/+$/, "");
    const target = cleanHost.endsWith("/api/v1")
      ? cleanHost
      : `${cleanHost}/api/v1`;

    console.log(`[next.config] Proxying /api/v1/* → ${target}/*`);

    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

export default nextConfig;

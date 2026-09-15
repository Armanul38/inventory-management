import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    let backendHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    if (!backendHost.startsWith("http://") && !backendHost.startsWith("https://")) {
      backendHost = `https://${backendHost}`;
    }
    const cleanHost = backendHost.replace(/\/+$/, "");
    const target = cleanHost.endsWith("/api/v1") ? cleanHost : `${cleanHost}/api/v1`;

    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers.ts";

const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.0.20"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }];
  },
};
export default config;
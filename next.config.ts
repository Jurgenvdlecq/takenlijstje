import type { NextConfig } from "next";

/**
 * Basisbeveiligingsheaders (security-review WP1, punt 3). Ze compenseren de
 * bewuste afwijking "sessiecookies niet HttpOnly" (TECHNICAL_DESIGN §4.1) tot
 * de volledige CSP met nonce er is. Deze CSP beperkt nog geen scripts; alleen
 * inbedden in frames, plugins en <base>.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

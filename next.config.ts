import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const isDev = process.env.NODE_ENV !== "production";

/**
 * A conservative CSP (spec §10): same-origin everything, no objects, forms only to us. Next injects
 * inline bootstrap scripts/styles, so `unsafe-inline` is required without a nonce pipeline; `eval`
 * is allowed in development only (HMR needs it).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root: a stray lockfile above the repo (e.g. ~/package-lock.json) makes Next's
  // root inference log a warning, and a wrong root also widens what gets traced for deployment.
  turbopack: { root: process.cwd() },
  // Accessing the dev server over the LAN (phone, another machine) needs the host allowed, or Next
  // blocks its dev resources. Development only; has no effect on a production build.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.110.3"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);

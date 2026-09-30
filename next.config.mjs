/**
 * Content Security Policy, production only (the dev server needs eval). Scripts and styles only from this site;
 * no plugins, no framing, forms post only here. Inline scripts are allowed because Next.js hydrates with them.
 */
const CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
  "font-src 'self' data:", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  // The serverless Chromium package ships a compressed binary; it must not be bundled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "@electric-sql/pglite", "postgres"],
  // Its compressed Chromium binaries are read from disk at runtime, so file tracing must be told to ship them.
  outputFileTracingIncludes: {
    "/api/p/[token]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/admin/cases/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] },
    // Family plans and the review screens hold personal information: never cached anywhere.
    { source: "/p/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    { source: "/fonts/:file*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }, { key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};
export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  // The serverless Chromium package ships a compressed binary; it must not be bundled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Its compressed Chromium binaries are read from disk at runtime, so file tracing must be told to ship them.
  outputFileTracingIncludes: { "/api/documents": ["./node_modules/@sparticuz/chromium/bin/**"] },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }, { source: "/fonts/:file*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }, { key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};
export default nextConfig;

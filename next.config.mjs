// Baseline security headers for a financial internal tool. No custom
// Content-Security-Policy — a strict CSP needs tuning against actual
// script/style sources and risks silently breaking the app; these headers
// are safe defaults that don't depend on knowing every asset source.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // pdfkit (used by @react-pdf/renderer) loads its standard font metrics via
  // a dynamic require Next's file tracer can't statically discover, so the
  // trace used by hosts that deploy a minimized file set (e.g. Hostinger)
  // drops them, producing "Cannot find module .../standard-fonts/*.cjs" at
  // runtime even though the build itself succeeds.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pdfkit/**/*"],
  },
};

export default nextConfig;

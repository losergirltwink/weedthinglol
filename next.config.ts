import type { NextConfig } from "next";

// Baseline security headers for every route. A full Content-Security-Policy
// (script-src with nonces) is deferred to launch hardening (docs/phase-5-plan.md
// 5E); the directives below are the ones that need no nonce plumbing.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Passkeys need the WebAuthn features on our own origin; nothing else is used.
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), " +
      "publickey-credentials-get=(self), publickey-credentials-create=(self)",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PGlite ships WASM + data files that must be loaded from node_modules at
  // runtime, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import path from "node:path";
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/**
 * Content Security Policy.
 *
 * `script-src` still needs `'unsafe-inline'` because Next.js emits an inline
 * bootstrap script on every page. Tightening this to a nonce means generating
 * one per request in `proxy.ts` and forfeiting static optimisation — worth
 * doing once the portal is behind a CDN, but not a good trade today. Every
 * other directive is locked down, and `frame-ancestors 'none'` plus
 * `object-src 'none'` remove the classes of attack that matter most here.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  ["connect-src 'self'", supabaseOrigin, supabaseOrigin.replace("https://", "wss://")]
    .filter(Boolean)
    .join(" "),
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Google is listed because the sign-in button POSTs to a Server Action that
  // responds with a redirect to Google's authorisation endpoint — browsers
  // apply `form-action` to redirects that follow a form submission, so
  // `'self'` alone would silently block sign-in.
  "form-action 'self' https://accounts.google.com",
  "worker-src 'self' blob:",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // The project sits inside a OneDrive folder that contains unrelated
  // lockfiles; pin the workspace root so Turbopack does not walk up and find
  // them.
  turbopack: {
    root: path.resolve(process.cwd()),
  },

  // Prisma's driver adapter and the pg client must stay on the Node side
  // rather than being bundled.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],

  // Uploaded evidence is served through short-lived signed URLs, never through
  // the image optimiser.
  images: { remotePatterns: [] },

  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Nothing under /api is cacheable — it is all per-user.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;

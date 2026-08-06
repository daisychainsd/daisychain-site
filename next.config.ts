import type { NextConfig } from "next";

// Content-Security-Policy. Sources are the hosts this site actually loads:
// Sanity CDN (images/audio), Adobe Typekit (fonts), Stripe (embedded
// checkout), Google Docs (SOP viewer on /ops), Shopify CDN (product photos),
// Supabase (REST + realtime), and the CMS-configured embed players.
//
// 'unsafe-eval' is required by Sanity Studio at /studio. It is scoped to that
// path below so the rest of the site runs without it.
const baseCsp = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net",
  "font-src 'self' data: https://use.typekit.net https://p.typekit.net",
  "img-src 'self' data: blob: https://cdn.sanity.io https://*.sanity.io https://cdn.shopify.com https://p.typekit.net",
  "media-src 'self' blob: https://cdn.sanity.io",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sanity.io https://api.stripe.com https://*.myshopify.com https://use.typekit.net https://p.typekit.net",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://docs.google.com https://bandcamp.com https://*.bandcamp.com https://w.soundcloud.com https://open.spotify.com https://www.youtube.com https://laylo.com https://*.laylo.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

const siteCsp = [
  ...baseCsp,
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
].join("; ");

const studioCsp = [
  ...baseCsp,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
].join("; ");

const sharedHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Download links carry ?session_id= / ?token=, which are bearer credentials.
  // Without this they leak to third parties in the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
  async headers() {
    return [
      // Studio first, and the site matcher excludes /studio — two matching CSP
      // headers are intersected by the browser, which would break Studio.
      {
        source: "/studio/:path*",
        headers: [...sharedHeaders, { key: "Content-Security-Policy", value: studioCsp }],
      },
      {
        source: "/((?!studio).*)",
        headers: [...sharedHeaders, { key: "Content-Security-Policy", value: siteCsp }],
      },
    ];
  },
};

export default nextConfig;

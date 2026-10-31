/** @type {import('next').NextConfig} */

// The Supabase project this build talks to, from the env var. Never hardcode a project host here.
let supabase = "";
try {
  supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
} catch {}

module.exports = {
  // Lint every source folder, or an unused import there passes locally and fails the production build.
  eslint: { dirs: ["app", "components", "lib", "features", "scripts"] },
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // A page used in the last three minutes reopens from the router cache. Safe only because every
    // writing server action calls revalidatePath or redirect(), which drops the whole client cache.
    staleTimes: { dynamic: 180, static: 300 }
  },
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 2678400,
    remotePatterns: supabase
      ? [{ protocol: "https", hostname: new URL(supabase).hostname, pathname: "/storage/v1/**" }]
      : [],
    deviceSizes: [360, 640, 828, 1080, 1200],
    imageSizes: [64, 96, 128, 200, 256, 384]
  },
  async redirects() {
    return [
      { source: "/register", destination: "/login?mode=signup", permanent: false },
      { source: "/signup", destination: "/login?mode=signup", permanent: false },
      { source: "/forgot-password", destination: "/login?mode=reset", permanent: false }
    ];
  },
  async headers() {
    const dev = process.env.NODE_ENV !== "production";
    const googleAuth = !["0", "false"].includes((process.env.NEXT_PUBLIC_GOOGLE_AUTH ?? "1").trim().toLowerCase());
    // Content-Security-Policy: no script or connection can leave this origin plus the Supabase project.
    // Adding a third-party script, font or image host means adding it here first.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${supabase}`.trim(),
      "font-src 'self' data:",
      `connect-src 'self' ${supabase} ${supabase.replace("https://", "wss://")}`.trim(),
      "worker-src 'self' blob:",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      `form-action 'self'${googleAuth && supabase ? ` ${supabase} https://accounts.google.com` : ""}`,
      "frame-ancestors 'self'",
      "upgrade-insecure-requests"
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=()" }
        ]
      }
    ];
  }
};

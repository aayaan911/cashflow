/** Product name and public origin. One place, so a rename or a custom domain is one edit. */
export const APP_NAME = "Cashflow";
export const APP_TAGLINE = "Private Financial Intelligence";

/**
 * The origin this deployment is reachable at: NEXT_PUBLIC_SITE_URL wins (set it when a custom domain
 * points here), then Vercel's production URL, then localhost for development.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

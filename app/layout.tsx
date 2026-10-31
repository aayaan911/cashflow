import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { APP_NAME, APP_TAGLINE, SITE_URL } from "@/lib/site";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});
/* The taka sign (U+09F3) only, under 1 KB a weight (OFL, see app/fonts/LICENSE). A page with no ৳ downloads nothing. */
const takaFont = localFont({
  src: [
    { path: "./fonts/kb-taka-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/kb-taka-700.woff2", weight: "700", style: "normal" }
  ],
  variable: "--font-bangla",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+09F3" }],
  preload: false,
  adjustFontFallback: false
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME}: ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: "Private financial intelligence: see where your money comes from, where it goes, and what is next.",
  applicationName: APP_NAME,
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231D9E75' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 17l6-6 4 4 8-8'/%3E%3Cpath d='M14 7h7v7'/%3E%3C/svg%3E",
        type: "image/svg+xml"
      }
    ]
  }
};

export const viewport: Viewport = {
  themeColor: "#1D9E75",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${takaFont.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}

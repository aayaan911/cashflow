import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  // relative: resolve the globs from this file, not the process cwd (a `next dev <dir>` run from another folder scanned the wrong tree and dropped every class only this tree uses)
  content: { relative: true, files: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" }
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      fontFamily: {
        // DM Sans draws every Latin letter and digit; --font-bangla is "KB Taka" (app/layout.tsx), a
        // one-glyph face with unicode-range U+09F3, so it only ever draws the taka sign.
        sans: ["var(--font-sans)", "var(--font-bangla)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        bangla: ["var(--font-bangla)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config;

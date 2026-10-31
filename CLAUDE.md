# Cashflow: Claude Code operating manual

**Cashflow, Private Financial Intelligence.** A personal-finance app for Ayaan and friends first, then Play Store and
App Store (free or about $1/month). Owner: Ayaan Ahmed Shohan. Premium feel is a requirement, not a polish pass.

Started 2026-10-31 from KinBird Pro's shell (`aayaan911/kinbird-pro-app`, untouched): design tokens, fonts,
`components/ui`, sidebar, topbar, PageTitle, KpiStrip, auth, middleware, CSP. No bird code, no KinBird data,
fresh git history.

## Stack (locked)
Next.js 14 App Router, TypeScript strict, Tailwind + CSS variable tokens (`app/globals.css`), Lucide icons,
Supabase (its own project, see `supabase/SETUP.md`), npm. Server Components + Server Actions; native
`<form action>`; no chart libraries (hand-rolled SVG); no client data fetching for lists.

## Rules
- `npm run verify` must pass before every push. Unused imports are a lint ERROR and break the Vercel build.
- Tokens only: `hsl(var(--...))`, no hex in app UI. Mobile-first (375px), tap targets 44px+.
- Never show a number the data cannot back; never put a page in the nav before it exists (`GROUPS` in
  `components/sidebar.tsx`).
- Every table: RLS on, owner policy `(select auth.uid()) = owner_id`, `deleted_at` soft delete, write the
  `.sql` into `supabase/manual-run/` first.
- Money is stored as integer minor units (paisa / cents), never floats.
- Middleware writes all session cookies on ONE response (getAll / setAll). Never go back to per-cookie handlers.
- Never commit `.env.local`, the service_role key or tokens. No em-dashes in user-visible copy.
- `app/globals.css` still carries KinBird's page-specific classes (`kb-room-*`, `npk-*`, `iso-*` ...); prune
  them as screens are built.

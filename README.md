# CIFLOW

**Private Financial Intelligence.** CIF (cifra, financial intelligence) + FLOW (cash flow, money movement).

Built on the design system and app shell of KinBird Pro (colours, fonts, layout, sidebar, sign-in), with none of
its bird code or data.

## Run it

```bash
npm install
cp .env.example .env.local   # then paste CIFLOW's own Supabase URL and anon key
npm run dev                  # http://localhost:3000
```

Before every push: `npm run verify` (typecheck + lint + format, all must pass).

## Setup

Supabase steps: [`supabase/SETUP.md`](supabase/SETUP.md).

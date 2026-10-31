# Supabase setup for Cashflow

Cashflow has its OWN Supabase project. Never point it at the KinBird project.

1. supabase.com, New project. Name `cashflow`. Region: **South Asia (Mumbai, ap-south-1)**, closest to Dhaka. `vercel.json` pins functions to `bom1` (Mumbai) to match: a function far from its database made KinBird login take 30-40s. Move both together or neither.
   Strong database password, saved in a password manager.
2. Project Settings, API: copy **Project URL** and the **anon / publishable key** into `.env.local`
   and into Vercel (Production + Preview). Never copy the service_role key anywhere public.
3. Authentication, URL Configuration: Site URL = the Vercel production URL. Redirect URLs:
   `http://localhost:3000/**`, `https://<production-domain>/**`, `https://*-<vercel-team>.vercel.app/**`.
4. Authentication, Sign In / Providers: Email on. Leave Phone off (`NEXT_PUBLIC_PHONE_AUTH` unset) and set
   `NEXT_PUBLIC_GOOGLE_AUTH=0` until Google is configured.
5. Tables come with the first feature. Each schema change is a `.sql` file in `supabase/manual-run/`, with RLS
   on and an owner policy `(select auth.uid()) = owner_id` on every table.

The daily cron in `vercel.json` calls `/api/health`, so a Free project is never paused for 7 days of inactivity.

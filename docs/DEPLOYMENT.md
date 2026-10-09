# Vercel deployment

This repository now builds as a standard Next.js app from repository root. Root app/ files are route adapters; the frontend components and backend handlers remain separate.

## Current preview scope

Publish with NEXT_PUBLIC_DEMO=true. This demonstrates the implemented login portals and classroom finder using generated sample rooms; it is not the completed campus system. Live Supabase workflows remain unverified.

## Deploy from Vercel

1. Import SHRIVARSHAAAP/CLASSROOM-ALLOCATION-SYSTEM at https://vercel.com/new.
2. Keep Root Directory as repository root (do not select frontend).
3. Use the Next.js framework preset. vercel.json supplies npm ci and npm run build.
4. Set NEXT_PUBLIC_DEMO=true for Production and Preview, then set DEMO_SESSION_SECRET to a random secret of at least 32 characters in both environments. Generate one locally with Node crypto.randomBytes(32).toString('hex'). Never commit it.
5. Deploy. Use the actual deployment URL returned by Vercel, and smoke-test all five portal demos, student department confirmation, room filters, logout and unauthenticated redirects.

CLI deployment requires Vercel account authentication. vercel login uses a device sign-in link. Once authenticated: link the project, set environment variables through vercel env add (stdin for secrets), and run vercel --prod. Keep the default account/project audience settings; don't change access controls without a user request. Authentication and a successful deployment must be verified before claiming the site is live.

## Live Supabase setup, after later workflows are implemented

Create an isolated Supabase project; run db/schema.sql then db/rls.sql once, validate statements and RLS behavior, and seed using explicitly supplied development environment variables. Storage buckets are private. Supply NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and server-only SUPABASE_SERVICE_ROLE_KEY. Disable demo mode for real data. Do not seed sample accounts into production.

The college map image is still missing. Timetable approvals, bookings, WhatsApp, maps and attendance are unfinished. This deployment is only the current demo.

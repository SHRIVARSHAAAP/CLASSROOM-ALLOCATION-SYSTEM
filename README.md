# PSG Smart Campus — fresh rebuild

A new Next.js 15 implementation of the PSG College of Technology Smart Campus Room Management System. The previous implementation remains in Git history. The current brief is [docs/SPECIFICATION.txt](docs/SPECIFICATION.txt).

## Frontend and backend

- `frontend/`: PSG login, role dashboards, map, timetable, forms, reports and PDF controls.
- `backend/`: signed demo sessions, Supabase login scaffolding, server role checks and demo action handler.
- `app/`: Next.js route adapters and server-protected pages.
- `lib/availability.ts`: the single availability calculation used by every feature.
- `lib/engine/`: pure constraint checks, first-fit baseline and ranked suggestions.
- `db/`: new Supabase schema and server-only seed script.

## Preview scope

Five role logins; 650 sample rooms across 13 blocks; daily and weekly timetables; CSV/Excel import validation; cancellation and issue review; dated classroom overrides; expiring single-use rep permissions; 14-college-day makeup suggestions; club booking, A4 HOD letter download, sample signed uploads and approval; notifications; reports; audit history; light/dark mode and mobile navigation.

**This is an interactive sample-data preview.** Browser storage holds the workflow records. The demo API checks the signed session role before calculating changes. No real college rooms are reserved. These sample-state checks are not production database transactions and do not provide cross-user booking concurrency. Sample uploads stay in browser storage; they do not reach Supabase Storage.

Live workflow API integration, transactional occupancy-ledger synchronization, private storage upload/download APIs, WhatsApp delivery/webhooks, surveyed walking-distance and heavy-day scoring, live analytics, actual campus image and production auth integration testing are still pending. SQL is supplied as a fresh schema, but has not been executed against a Supabase project in this session.

## Run locally

```bash
npm ci
cp .env.example .env.local
```

Set `NEXT_PUBLIC_DEMO=true` and a random `DEMO_SESSION_SECRET` of at least 32 characters in `.env.local`. Never commit that file. Then:

```bash
npm run dev
```

Open http://localhost:3000. Choose a portal, accept the demo terms, and open the sample account. The profile menu can switch demo roles so requests can be reviewed by another portal. Browser records are shared only within the same browser and deployment origin.

```bash
npm run format
npm run check
```

## Vercel

Import this repository with the Next.js framework, repository root, `npm ci` and `npm run build`. Add `NEXT_PUBLIC_DEMO=true` and a securely generated `DEMO_SESSION_SECRET` for the demo. Never upload local `.env` files.

Temporary Vercel CLI deployments must be claimed through the privately supplied claim link before expiry to remain available. Claim credentials are never committed.

## Live setup checklist

1. Create a Supabase test project and execute `db/schema.sql`. Review and test RLS, constraints, indexes and migrations.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Run `node --env-file=.env.local db/seed.mjs`. Set `SEED_TEST_PASSWORD` only when test auth users are desired; no default test password is committed.
4. Integrate real workflow handlers and synchronized dated occupancy transactions. Test race conditions and authorization against the configured database.
5. Configure private storage, account recovery redirect URLs and provider templates/consent.
6. Disable demo mode, verify all live flows and confirm that the service-role key is absent from browser bundles.

## Supabase live integration

The website now has separate real-data APIs:
- GET /api/campus loads shared PostgreSQL records; POST validates authenticated actions against server-loaded data.
- A server-only RPC serializes writes and rebuilds dated occupancy inside the transaction. Exclusion constraints reject concurrent room/faculty/section overlaps.
- Letter uploads are validated by MIME, magic bytes and decoded size, saved to the private campus-private bucket, and served to the owner/admin with five-minute signed URLs.
- Real mode never initializes browser sample records. Account roles, section IDs, faculty UUIDs and club_permission come from users.
- Public key aliases: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY. Server key: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY. No server key is sent to the browser.

Setup for the existing Supabase project:
1. Apply db/live-integration.sql in SQL Editor after the original schema.
2. Confirm the admin Auth user has an active admin profile.
3. Keep NEXT_PUBLIC_DEMO=true until the migration succeeds; then change it to false in Vercel and redeploy.
4. Use the real admin email/password. An empty database displays empty tables, never fictional timetable data.
5. Create real section records and actual faculty/rep/student/club accounts. Link the accounts to users; set roll numbers uppercase, assign section_id, and enable club_permission only for approved organizers.
6. Add verified room capacities and working facilities in Admin. Import the real timetable CSV with existing section IDs, exact faculty names, actual room codes and IST times.
7. Verify login for all roles, cancellation approval, single-use rep permissions, makeup confirmation, signed-letter upload and approval from separate browsers.

Do not execute db/test-foundation.sql or db/test-live.sql on the real project: these are disposable CI fixtures.
Do not copy the browser demo into production. The old seed script creates fictional sample records and is not a production import.
WhatsApp is not connected; database delivery records explicitly show no delivery. Real WhatsApp provider setup remains separate.
Before enabling real users, verify the flows against the configured Supabase project. CI checks use an isolated PostgreSQL instance, not the user's live database.

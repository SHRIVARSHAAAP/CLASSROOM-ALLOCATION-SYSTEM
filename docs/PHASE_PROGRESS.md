# Build progress

## Phase 1 — foundation

Implemented Next.js 14 App Router and TypeScript with separate frontend components/API adapters and backend handlers. Added Supabase schema/RLS/storage setup, database-backed login throttling, server RBAC, signed demo sessions, student department confirmation, roll-number parser, 650-room generator and Supabase sample seed. Added a lazy 3D hero with fallback, five portal cards and protected dashboard shell.

Checks: TypeScript, ESLint, 27 Vitest tests, Next production build passed. HTTP smoke checks passed for all five demo logins, protected dashboard rendering, logout and cross-origin rejection. SQL and live Supabase authentication are not integration-tested because a Supabase project is not configured. The actual campus map was not attached; verified anchors remain empty.

Dependencies: Next.js 14 is retained as explicitly requested, but npm audit reports known critical advisories. Production deployment requires upgrading to a patched supported major and revalidation; details in SECURITY.md. Vercel and Supabase deployment credentials are not available in this session.

Remaining phases: 2–11 have not been completed. The previous Python prototype is kept for history but is not used by Next.js.

## Phase 2 — shared availability and classroom finder slice

Implemented lib/availability.ts, authenticated room search, date/time/capacity/building/working-facility filters, occupancy status cards, cancellation/override layering and common checks for room/faculty/section conflicts. The sample finder has 650 uniquely numbered rooms and illustrative occupancy. Real-mode queries use Supabase room_occupancy and classroom_resources.

All four checks pass; 35 unit tests total. HTTP smoke checks cover unauthorized access, all 650 rooms, combined free/capacity/facility filtering, finder rendering and invalid calendar dates.

This is a completed availability feature, not the whole phase. Admin CRUD, timetable import/manual editing/publishing and weekly views are still pending. No later phase is marked complete. Live query verification and transactional workflow development require a configured Supabase test database.

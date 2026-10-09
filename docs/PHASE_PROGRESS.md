# Build progress

## Phase 1 — foundation

Implemented Next.js 14 App Router and TypeScript with separate frontend components/API adapters and backend handlers. Added Supabase schema/RLS/storage setup, database-backed login throttling, server RBAC, signed demo sessions, student department confirmation, roll-number parser, 650-room generator and Supabase sample seed. Added a lazy 3D hero with fallback, five portal cards and protected dashboard shell.

Checks: TypeScript, ESLint, 27 Vitest tests, Next production build passed. HTTP smoke checks passed for all five demo logins, protected dashboard rendering, logout and cross-origin rejection. SQL and live Supabase authentication are not integration-tested because a Supabase project is not configured. The actual campus map was not attached; verified anchors remain empty.

Dependencies: Next.js 14 is retained as explicitly requested, but npm audit reports known critical advisories. Production deployment requires upgrading to a patched supported major and revalidation; details in SECURITY.md. Vercel and Supabase deployment credentials are not available in this session.

Remaining phases: 2–11 have not been completed. The previous Python prototype is kept for history but is not used by Next.js.

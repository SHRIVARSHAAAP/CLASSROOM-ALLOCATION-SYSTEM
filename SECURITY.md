# Security status

Do not present this build as production-ready. This project follows the requested Next.js 14 stack. npm audit reports known critical advisories affecting 14.2.35. Upgrading to a patched major, resolving all runtime dependency advisories and rerunning checks are required before deployment with real campus data. See https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4.

Authentication uses Supabase Auth; live passwords are handled by Supabase. Admin-issued identities are seeded only with an explicitly supplied development password. Authorization runs in server handlers. Supabase service keys are server-only. Demo tokens are HMAC-signed, expire after eight hours, and use HttpOnly SameSite cookies. Demo mode never falls through to live mutations. Disable it for production. Use a random DEMO_SESSION_SECRET with at least 32 characters.

Supabase RLS defaults to no direct writes. Storage buckets are private. Live login throttling is database-backed. Mutation routes reject cross-origin requests. Audit rows are immutable. Reservation ledger exclusion constraints are the intended race-safe foundation for later transactional approval functions. Those approval functions are not implemented in Phase 1.

Database SQL, storage policies and live auth must be checked against a real isolated Supabase project. Never expose a service role key in NEXT_PUBLIC variables. No supplied map image or signed documents are committed.

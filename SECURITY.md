# Security status

Do not present this build as production-ready. Deployment preparation upgraded Next.js 14.2.35 to 15.5.27, updated Supabase, and pinned patched PostCSS/UUID dependencies. The earlier Next.js 14 warning is retained in development history; do not use that old version for deployment. The prepared build reports zero production dependency vulnerabilities in npm audit. Live Supabase integrations and unfinished workflow security still require verification.

Authentication uses Supabase Auth; live passwords are handled by Supabase. Admin-issued identities are seeded only with an explicitly supplied development password. Authorization runs in server handlers. Supabase service keys are server-only. Demo tokens are HMAC-signed, expire after eight hours, and use HttpOnly SameSite cookies. Demo mode never falls through to live mutations. Disable it for production. Use a random DEMO_SESSION_SECRET with at least 32 characters.

Supabase RLS defaults to no direct writes. Storage buckets are private. Live login throttling is database-backed. Mutation routes reject cross-origin requests. Audit rows are immutable. Reservation ledger exclusion constraints are the intended race-safe foundation for later transactional approval functions. Those approval functions are not implemented in Phase 1.

Database SQL, storage policies and live auth must be checked against a real isolated Supabase project. Never expose a service role key in NEXT_PUBLIC variables. No supplied map image or signed documents are committed.

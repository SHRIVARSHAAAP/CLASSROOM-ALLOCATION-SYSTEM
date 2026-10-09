# Vercel and Supabase deployment preparation

No Vercel deployment has been performed and no Supabase project is configured. This is Phase 1 setup, not the final Phase 11 deployment checklist.

1. Resolve the Next.js 14 dependency advisories by moving to a patched supported major; re-run all checks. Preserve requested architecture and document the stack change.
2. Create an isolated Supabase project. In its SQL editor run db/schema.sql then db/rls.sql, once, on a new database. Verify all statements and RLS behavior. The scripts create private signed-letters and issue-photos buckets with MIME/size limits; signed-URL routes are a later phase.
3. Store the Supabase URL and anon key in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Store SUPABASE_SERVICE_ROLE_KEY only as a server secret.
4. To seed development accounts, set these values and SEED_USER_PASSWORD in a terminal, then npm run seed. Account emails use campus.example; students log in with 23Z001 through 23Z060. Never commit the password.
5. Import SHRIVARSHAAAP/CLASSROOM-ALLOCATION-SYSTEM into Vercel. Keep repository root as the project root because shared backend/lib folders are outside frontend. Set framework preset to Other, install command npm ci, build command npm run build. Configure the Next.js project deployment integration with frontend as its app directory and access to parent source; verify this monorepo configuration with Vercel before publication. A tested vercel.json is still pending.
6. Set NEXT_PUBLIC_DEMO=false for real auth. Use demo mode only with sample records and a server-only random DEMO_SESSION_SECRET. WHATSAPP_MODE=mock until WhatsApp integration is implemented and verified.
7. Choose a deployment region near the Supabase region. Check home/login, wrong-role rejection, all five portal entries, student department confirmation, logout and unauthenticated redirects before sharing.

Live reservation, upload, attendance, WhatsApp and map smoke tests belong to the final phase. The actual college map image is still required; do not invent or redraw it.

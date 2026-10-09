# Fresh rebuild progress

The user requested a new implementation from scratch on 2026-10-09. This project was created in a separate worktree and contains new application code. Previous work remains in repository history.

Implemented a complete navigable sample-data preview with five server-authenticated portals, PSG-style login, shared availability logic, room management and maintenance, timetable import checks, map, dated cancellations and room changes, expiring single-use permissions, ranked makeups, club booking and PDF/signed-letter flow, notifications, Recharts reports and audit CSV export.

Live Supabase workflow persistence, occupancy-ledger transaction synchronization, real private storage, WhatsApp, production account recovery/auth verification and advanced distance/stability reports are not connected. The actual campus-map image was not attached; the preview clearly labels its schematic. The generated dashboard design image shown in chat was a proposed mockup, not an actual deployed screenshot.

Validation: ESLint, TypeScript, 17 domain tests and the production build passed. HTTP smoke checks passed for the homepage, login and dashboard for all five roles, and rejection of cross-origin login requests. Live database policies have not been executed or verified. Deployment details are added after publication. No private deployment claim credential belongs in this file.

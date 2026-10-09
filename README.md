# Classroom Allocation System

## Separate frontend and backend

| Folder | Responsibility | Technology |
| --- | --- | --- |
| frontend/ | Five login portals, dashboards, room forms and search | HTML, CSS, JavaScript |
| backend/ | Authentication, authorization, database and audit | Python 3.12+, SQLite |
| docs/ | Feature roadmap and development log | Markdown |

## Start locally

Set CAMPUS_SETUP_PASSWORD to a password of at least 12 characters in your terminal environment, then run:

```bash
python backend/server.py --setup
python backend/server.py
```

Open http://localhost:8000. Setup creates local development accounts for admin@campus.local, rep@campus.local, club@campus.local, faculty@campus.local and student@campus.local. Select the matching portal and use your setup password. Remove the environment variable after setup. Setup refuses to overwrite existing accounts.

## Implemented: first phase

Five-role login, expiring sessions, server-enforced admin permissions, classroom search, creation, editing, deactivation, maintenance flags, capacity/facilities and administrator audit history. Passwords use salted PBKDF2. Database files and secrets are excluded from Git.

Non-admin dashboards currently show the classroom directory. In-service rooms are active and not under maintenance; this does not indicate time-slot availability. Timetables, booking and approval workflows are planned in docs/ROADMAP.md.

## Verification

```bash
python -m unittest discover -s backend -p 'test_*.py' -v
node --check frontend/app.js
```

This initial implementation runs locally. Production deployment requires HTTPS, account provisioning, rate limiting and backups.

## GitHub process

Use one descriptive commit per completed feature, run its checks, update docs/DEVELOPMENT.md and push. Local commits preserve actual progress while authenticated GitHub write access is unavailable.

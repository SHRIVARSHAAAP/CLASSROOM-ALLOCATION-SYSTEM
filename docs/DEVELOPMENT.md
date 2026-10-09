# Development log

## 2026-10-09

The repository initially contained only a README. Reviewed the provided specification and separated frontend and backend. Implemented phase 1: login for five roles, admin room management, directory search, maintenance status and audit trail.

GitHub read access works. Push dry-run failed because authenticated write access is missing. The GitHub connection was requested but not completed. Local commits preserve progress pending connection.

For each subsequent feature: implement, validate, update this log, commit, and push with authenticated write access. Never commit databases, credentials or signed permission documents.

## Interactive preview

Added frontend/preview with sample room data and portal selection for demonstrating phase 1. The preview clearly identifies itself as sample data; it does not connect to the Python API. Its changes stay in the browser session. The original frontend and backend remain the full local implementation.

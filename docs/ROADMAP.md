# Feature roadmap

| Phase | Frontend | Backend | Status |
| --- | --- | --- | --- |
| 1 | Login portals, admin classroom forms, directory | Authentication, roles, SQLite, rooms, audit | Implemented |
| 2 | Fixed timetable import, weekly views, availability finder | CSV/Excel import, recurrence and common occupancy checks | Planned |
| 3 | Rep cancellation/issue forms and admin review | Section ownership, reports and approval transitions | Planned |
| 4 | Rescheduling and room suggestions | Capacity, facilities, room/faculty/section conflicts, one-time overrides | Planned |
| 5 | Rep permission requests and approved editing | One-use session-scoped grants, expiry and revocation | Planned |
| 6 | Club booking and HOD letter download | Unique references, booking drafts, A4 PDF generation | Planned |
| 7 | Signed letter upload and booking tracking | Private uploads, admin verification and atomic reservations | Planned |
| 8 | Website notifications and delivery status | Notification outbox, WhatsApp Cloud API and delivery callbacks | Planned |
| 9 | Utilization reports and audit filters | Analytics, allocation baseline comparison and workflow tests | Planned |

Preserve the recurring timetable for occurrence changes. Reps report cancellations and issues; faculty schedules are read-only. Report cancellation reasons to admins. Notify reps and faculty after rescheduling. Rep grants must be specific, one-use and time-limited. Check all occupancy sources together and recheck during approval transactions. Club approval requires a signed HOD letter. Website notifications must survive WhatsApp failure; WhatsApp needs real credentials, consent and applicable templates.

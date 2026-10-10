# Restore the supplied campus records

Open db/restore-supplied-campus.sql, copy the entire file, paste it into Supabase SQL Editor, and click Run. This is the only database step. Then refresh the existing Vercel website; keep NEXT_PUBLIC_DEMO=false.

The import preserves existing user profiles, passwords, bookings and one-day changes. Repeating the file does not duplicate the imported timetable.

Included: 13 blocks; 55 rooms (23 codes from the timetable plus 32 explicitly requested sample filler rooms); 22 first-year sections; 12 official periods; 568 recurring session blocks reconstructed by printed table position; 378 course/staff entries with 170 distinct printed names. Consecutive lab periods are kept together. Blank lab venues remain unset. Parallel lab course codes printed in the same cell remain together. Individual faculty assignments are not specified by the PDF and are not guessed.

Sources: First Year BE_BTech Class Timetable-2026_27 ODD Sem.pdf, export dated 20 August 2026, all 66 pages; supplied 22-section seed table. The map uploaded to GitHub remains public/campus-map.jpg. The permission letter follows the supplied Program Coordinator format.

Room capacity 60 and lecture type are provisional sample defaults; the PDF has section strengths, not measured room capacities or working facilities. Admin must confirm actual room capacity/type/resources before relying on bookings. No working projector/lab equipment counts are invented.

The supplied test roll numbers and rep addresses are linked if their real Supabase Auth accounts already exist. The import never creates passwords or invents student emails. The existing real admin account is preserved. Actual student names/emails and faculty login credentials were not in the recovered timetable PDF. Staff course lists are imported independently of login accounts.

WhatsApp remains inactive without provider credentials, and its setup panel is hidden.

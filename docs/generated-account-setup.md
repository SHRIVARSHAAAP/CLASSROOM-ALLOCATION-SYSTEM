# Owner-requested temporary accounts and assignments

1. Run the UPDATED db/restore-supplied-campus.sql in Supabase SQL Editor. It is safe to repeat and preserves existing profiles/passwords and imported recurring times. If you already imported the timetable, db/generated-account-setup.sql is the smaller alternative.
2. Sign in with your existing real admin.
3. Open Admin → Classrooms → Create accounts and assign teachers.
4. Keep the page open while accounts are created, then Download private login list. It contains passwords only for newly created accounts. Existing accounts/passwords are preserved. If interrupted, resume in the same tab.
5. Refresh the website to see the faculty timetables and generated room resources.

Planned accounts: admin@gmail.com; 168 faculty accounts named from the PDF (for example gopalramsd@gmail.com); 22 class reps (cseg1@gmail.com etc.); 44 generated student names/emails, two per section (kavin@gmail.com is 26Z264, manoj@gmail.com is 26Z364, vignesh@gmail.com is 26L264, sahana@gmail.com is 26B215); theeye@gmail.com and codingclub@gmail.com.
Existing roll-number profiles are reused instead of duplicated, so the final number of new accounts may be smaller.

The setup uses a randomly generated password kept only in the browser and authenticated server requests. It is never committed to GitHub. The downloadable login list is private and should not be shared publicly. No invitation or reset emails are sent to guessed Gmail addresses. Password resets are blocked for generated profiles.

All 463 class/lab entries receive a generated teacher assignment chosen from that section's printed course pool, with no overlaps for the same teacher. Library/tutor-ward periods remain non-teaching entries. Individual assignments are GENERATED, not official assignments from the college PDF. Existing non-null faculty assignments are never overwritten, and database clash checks roll back incompatible changes.

Room capacities/types/resources are owner-authorized generated sample settings, applied only to unverified rooms without existing resource records on the first setup. They remain marked unverified. Timetable dates, course titles, periods, sections and room codes are retained. WhatsApp remains inactive.

Real account activation inside Supabase happens only when you click the authenticated Admin setup button; deploying code does not itself create those accounts.

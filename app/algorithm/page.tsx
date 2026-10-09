import Link from "next/link";
export default function Page() {
  return (
    <main className="message-page">
      <Link href="/portal" className="secondary">
        Back to workspace
      </Link>
      <h1>How the allocator works</h1>
      <p className="muted">
        It checks whether a room works before ranking suitable choices.
      </p>
      <section className="panel">
        <h2>1. Check the constraints</h2>
        <p>
          Faculty free. Section free. Room free for the whole period. Enough
          seats. Required facilities working in sufficient quantities. Active
          room and no maintenance conflict.
        </p>
        <h2>2. Rank valid rooms</h2>
        <p>
          Seat fit contributes up to 65 points. The same block contributes 30.
          Five base points are included. Using a computer lab without needing
          computers costs 15 points.
        </p>
        <h2>3. Find a makeup slot</h2>
        <p>
          Search 14 college days, skipping Sundays and configured holidays.
          Deduct a delay penalty and show the three highest-ranked options. The
          admin confirms one; the current sample records are checked again.
        </p>
        <h2>4. Keep the fixed plan intact</h2>
        <p>
          The change becomes a dated cancellation, makeup or classroom override.
          The weekly recurring timetable is never rewritten by that change.
        </p>
      </section>
      <p className="info-note">
        The current preview uses sample records. Walking-distance and heavy-day
        scoring, production database transactions and live notification
        providers are not connected yet.
      </p>
    </main>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { CampusArt, Logo } from "@/frontend/visuals";
export default function Page() {
  return (
    <main className="landing">
      <nav>
        <Link href="/" className="brand">
          <Logo />
          <span>
            SMART CAMPUS<small>PSG College of Technology</small>
          </span>
        </Link>
        <Link href="/login/student" className="secondary">
          Open a portal <ArrowRight size={16} />
        </Link>
      </nav>
      <section className="landing-hero">
        <div>
          <span className="eyebrow">ROOM FOR A BETTER CAMPUS DAY</span>
          <h1>
            Every classroom.
            <br />
            Every class.
            <br />
            <em>Connected.</em>
          </h1>
          <p>
            One workspace for fixed timetables, classroom changes and club
            events. Designed around the people who make campus happen.
          </p>
          <Link href="/login/student" className="primary">
            Enter your portal <ArrowRight size={18} />
          </Link>
          <p className="landing-note">
            <CheckCircle2 size={16} />
            Five role portals · Sample campus preview
          </p>
        </div>
        <div className="landing-art">
          <CampusArt />
          <span>CLASSROOMS · PEOPLE · IDEAS</span>
        </div>
      </section>
      <section className="landing-features">
        <article>
          <Building2 />
          <strong>13 academic blocks</strong>
          <p>
            Explore 650 sample classrooms by capacity, floor and working
            facilities.
          </p>
        </article>
        <article>
          <CalendarDays />
          <strong>Fixed plans. Flexible changes.</strong>
          <p>
            Dated cancellations and room changes keep the weekly timetable
            intact.
          </p>
        </article>
        <article>
          <CheckCircle2 />
          <strong>Approval before allocation</strong>
          <p>
            Check faculty, section and room availability before confirming a
            change.
          </p>
        </article>
      </section>
      <footer>
        SMART CAMPUS · STUDENT PROJECT
        <span>Sample records. No real room reservations.</span>
      </footer>
    </main>
  );
}

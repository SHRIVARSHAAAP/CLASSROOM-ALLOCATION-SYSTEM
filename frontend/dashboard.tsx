"use client";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  School,
} from "lucide-react";
import { availability } from "@/lib/availability";
import { today, type State, type User } from "@/lib/types";
import { CampusArt } from "./visuals";
export function Tag({ status }: { status: string }) {
  return (
    <span
      className={
        "tag " +
        (["approved", "scheduled", "resolved"].includes(status)
          ? "tag-green"
          : ["cancelled", "rejected", "revoked"].includes(status)
            ? "tag-red"
            : "tag-blue")
      }
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
export function effectiveSessions(state: State, date: string, user: User) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return state.sessions
    .filter(
      (s) =>
        s.day === day && !state.holidays.includes(date) &&
        (!s.validFrom || date >= s.validFrom) && (!s.validTo || date <= s.validTo) &&
        (user.role === "admin" ||
          (user.role === "faculty"
            ? s.facultyId === "F0"
            : s.section === "CSE II A")),
    )
    .map((session) => {
      const override = state.overrides.find(
        (o) => o.date === date && o.sessionId === session.id,
      );
      return {
        ...session,
        roomId: override?.roomId ?? session.roomId,
        status: override?.cancelled
          ? "cancelled"
          : override?.roomId
            ? "room_changed"
            : "scheduled",
        override,
      };
    });
}
export default function Dashboard({
  state,
  user,
}: {
  state: State;
  user: User;
}) {
  const date = today();
  const sessions = effectiveSessions(state, date, user);
  const pending = state.requests.filter((r) => r.status === "pending");
  const notices = state.notifications.filter((n) =>
    n.roles.includes(user.role),
  );
  const showAvailability = user.role !== "student" && user.role !== "faculty";
  const available = !showAvailability ? 0 : state.rooms.filter(
    (r) => availability(state, r, { date, start: "09:00", end: "10:00" }).free,
  ).length;
  const stats =
    user.role === "admin"
      ? ([
          ["Total classrooms", state.rooms.length, Building2],
          ["Academic blocks", state.catalog?.blockCount ?? new Set(state.rooms.map((room) => room.block)).size, School],
          [
            "Pending approvals",
            pending.length +
              state.bookings.filter(
                (b) => b.status === "signed_letter_submitted",
              ).length,
            ClipboardCheck,
          ],
          [
            "Today’s classes",
            sessions.filter((s) => s.status !== "cancelled").length,
            CalendarDays,
          ],
        ] as const)
      : ([
          [
            user.role === "club" ? "My bookings" : "Today’s classes",
            user.role === "club"
              ? state.bookings.length
              : sessions.filter((s) => s.status !== "cancelled").length,
            CalendarDays,
          ],
          ...(!showAvailability ? [] : [["Available rooms*", available, Building2] as const]),
          [
            "Unread updates",
            notices.filter((n) => !n.read.includes(user.role)).length,
            Bell,
          ],
        ] as const);
  return (
    <>
      <section className="welcome-panel">
        <div>
          <h2>Make room for a better campus day.</h2>
          <p>
            Classrooms, people and ideas.
            <br />
            Brought together in one connected workspace.
          </p>
          <Link
            href={
              user.role === "admin"
                ? "/portal/map"
                : user.role === "club"
                  ? "/portal/rooms"
                  : "/portal/timetable"
            }
          >
            Explore your workspace <ArrowRight size={16} />
          </Link>
        </div>
        <CampusArt />
      </section>
      <div className="stat-grid">
        {stats.map(([label, value, Icon]) => (
          <article key={label}>
            <span className="stat-icon">
              <Icon size={23} />
            </span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>
      {user.role !== "admin" && showAvailability && (
        <p className="muted small">
          *Availability count uses the 09:00–10:00 IST slot.
        </p>
      )}
      <div className="dashboard-panels">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {user.role === "club"
                ? "My upcoming booking"
                : "Today’s timetable"}
            </h2>
            <Link
              href={
                user.role === "club"
                  ? "/portal/my-bookings"
                  : "/portal/timetable"
              }
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {user.role === "club" ? (
            <div className="upcoming-event">
              <CalendarDays size={34} />
              <h3>{state.bookings[0]?.event ?? "Plan your next event"}</h3>
              <p className="muted">
                {state.bookings[0]
                  ? `${state.bookings[0].date} · ${state.bookings[0].start}–${state.bookings[0].end}`
                  : "Find a room and create a booking request."}
              </p>
              <Link href="/portal/booking-request" className="secondary">
                Request a classroom
              </Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Time · IST</th>
                    <th>Room</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 5).map((session) => (
                    <tr key={session.id}>
                      <td>
                        {session.subject}
                        <small>{session.section}</small>
                      </td>
                      <td>
                        {session.start}–{session.end}
                      </td>
                      <td>
                        {
                          state.rooms.find((r) => r.id === session.roomId)
                            ?.number
                        }
                      </td>
                      <td>
                        <Tag status={session.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!sessions.length && (
                <div className="empty-state">
                  <CalendarDays />
                  <h3>No classes today</h3>
                  <p>
                    Your fixed weekly timetable is available in the sidebar.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {user.role === "admin" ? "Requests to review" : "Campus updates"}
            </h2>
            <Bell size={19} />
          </div>
          {user.role === "admin"
            ? pending.slice(0, 3).map((request) => (
                <article className="review-row" key={request.id}>
                  <span
                    className={
                      "review-icon " +
                      (request.type === "issue" ? "review-amber" : "review-red")
                    }
                  >
                    <ClipboardCheck size={20} />
                  </span>
                  <div>
                    <strong>
                      {request.type === "permission"
                        ? "Room-change permission"
                        : request.type === "issue"
                          ? "Classroom issue"
                          : "Class cancellation"}
                    </strong>
                    <p>{request.reason}</p>
                    <small>
                      {request.date} · {request.reporter}
                    </small>
                  </div>
                  <Link
                    href={
                      "/portal/" +
                      (request.type === "permission"
                        ? "permissions"
                        : request.type === "issue"
                          ? "issues"
                          : "cancellations")
                    }
                  >
                    Review
                  </Link>
                </article>
              ))
            : notices.slice(0, 3).map((notice) => (
                <article className="review-row" key={notice.id}>
                  <span className="review-icon">
                    <Bell size={18} />
                  </span>
                  <div>
                    <strong>{notice.title}</strong>
                    <p>{notice.body}</p>
                  </div>
                </article>
              ))}
          {user.role === "admin" && !pending.length && (
            <div className="empty-state">
              <ClipboardCheck />
              <h3>No pending reports</h3>
              <p>You’re all caught up.</p>
            </div>
          )}
        </section>
      </div>
      {showAvailability && (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Classroom availability</h2>
            <p className="muted small">
              Room availability · {date} · 09:00–10:00 IST
            </p>
          </div>
          <Link
            href={
              user.role === "admin"
                ? "/portal/classrooms"
                : user.role === "rep"
                  ? "/portal/change-room"
                  : "/portal/rooms"
            }
          >
            Find a classroom <ArrowRight size={14} />
          </Link>
        </div>
        <div className="compact-rooms">
          {state.rooms
            .filter((r) => ["C-1", "A-1", "D-1"].includes(r.id))
            .map((room) => {
              const status = availability(state, room, {
                date,
                start: "09:00",
                end: "10:00",
              });
              return (
                <article key={room.id}>
                  <h3>{room.number}</h3>
                  <p>
                    <Building2 size={14} />
                    {room.block} Block<span>·</span>
                    {room.capacity} seats
                  </p>
                  <span
                    className={"tag " + (status.free ? "tag-green" : "tag-red")}
                  >
                    {status.label}
                  </span>
                  <small>{status.reason}</small>
                </article>
              );
            })}
        </div>
      </section>
      )}
    </>
  );
}

"use client";
import { useMemo, useState } from "react";
import FacultyPool from "./faculty-pool";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  Upload,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DemoAction } from "@/backend/actions";
import { availability } from "@/lib/availability";
import { rank, suggestions, type Needs } from "@/lib/engine";
import { csv, download, letter } from "@/lib/files";
import { publish } from "@/lib/workflows";
import {
  blockIds,
  nextDate,
  slotSchema,
  today,
  type Booking,
  type Request,
  type Room,
  type Session,
  type State,
  type User,
} from "@/lib/types";
import Rooms, { facilities } from "./rooms";
import TimetableTables, { type TimetableRow } from "./timetable-tables";
import { effectiveSessions, Tag } from "./dashboard";

export type FeatureProps = {
  demo?: boolean;
  state: State;
  user: User;
  action: (input: DemoAction, message?: string) => Promise<void>;
  busy: boolean;
  save: (state: State) => void;
};
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <ClipboardCheck size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function FormField({
  title,
  name,
  placeholder,
  value,
  required = true,
}: {
  title: string;
  name: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label>
      {title}
      <input
        name={name}
        required={required}
        defaultValue={value}
        placeholder={placeholder}
      />
    </label>
  );
}

export function RequestForm({
  state,
  user,
  action,
  busy,
  kind,
}: FeatureProps & { kind: Request["type"] }) {
  const [date, setDate] = useState(today());
  const sessions = effectiveSessions(state, date, user).filter(
    (s) => s.status !== "cancelled",
  );
  return (
    <div className="form-layout">
      <section className="panel">
        <h2>
          {kind === "cancellation"
            ? "Report a class cancellation"
            : kind === "issue"
              ? "Tell us about a classroom issue"
              : "Request a classroom change"}
        </h2>
        <p className="muted">
          Your administrator reviews the request before a change is made.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action(
              {
                type: "report",
                kind,
                date,
                sessionId: String(form.get("session")),
                reason: String(form.get("reason")),
              },
              "Request sent to the admin portal.",
            );
          }}
        >
          <label>
            Class date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label>
            Session
            <select required name="session">
              <option value="">Choose your scheduled class</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.start} · {session.subject}
                </option>
              ))}
            </select>
          </label>
          <label>
            {kind === "issue" ? "Issue type and details" : "Reason"}
            <textarea
              required
              name="reason"
              minLength={5}
              maxLength={1000}
              rows={5}
              placeholder={
                kind === "issue"
                  ? "Example: Projector failure — the projector will not turn on."
                  : "Explain the reason for your request…"
              }
            />
          </label>
          <button className="primary" disabled={busy || !sessions.length}>
            Send request <ArrowRight size={16} />
          </button>
        </form>
      </section>
      <aside className="help-panel">
        <CalendarDays size={34} />
        <h3>One date. One clear decision.</h3>
        <p>
          Your fixed timetable stays unchanged. Admin decisions appear in My
          Requests and Notifications.
        </p>
        <ol>
          <li>Rep reports the reason.</li>
          <li>Admin reviews and adds a decision note.</li>
          <li>
            {kind === "permission"
              ? "Approved permissions expire after 24 hours and are single-use."
              : kind === "cancellation"
                ? "Approval releases the room for this date and can trigger makeup suggestions."
                : "Admin tracks the issue and can block the room for maintenance."}
          </li>
        </ol>
      </aside>
    </div>
  );
}
function RequestCard({
  request,
  state,
  user,
  action,
  busy,
}: FeatureProps & { request: Request }) {
  const [note, setNote] = useState("");
  const [makeup, setMakeup] = useState(true);
  const session = state.sessions.find((s) => s.id === request.sessionId);
  return (
    <article className="panel request-card">
      <div className="panel-heading">
        <span className="eyebrow">{request.type}</span>
        <Tag status={request.status} />
      </div>
      <h3>{session?.subject}</h3>
      <p className="muted small">
        {session?.section} · {request.date} · {session?.start}–{session?.end}{" "}
        IST
      </p>
      <div className="reason-box">
        <strong>Reason</strong>
        <p>{request.reason}</p>
      </div>
      <small className="muted">Reported by {request.reporter}</small>
      {request.note && (
        <p>
          <strong>Admin:</strong> {request.note}
        </p>
      )}
      {request.expires && (
        <p className="muted small">
          Expires{" "}
          {new Date(request.expires).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}{" "}
          IST
        </p>
      )}
      {user.role === "admin" && request.status === "pending" && (
        <>
          <label>
            Decision note
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add your reason or instructions"
            />
          </label>
          {request.type === "cancellation" && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={makeup}
                onChange={(event) => setMakeup(event.target.checked)}
              />
              Makeup class required
            </label>
          )}
          <div className="actions">
            <button
              className="primary"
              disabled={busy || note.trim().length < 3}
              onClick={() =>
                void action(
                  {
                    type: "decide",
                    id: request.id,
                    status: "approved",
                    note,
                    makeup,
                  },
                  "Request approved. The affected portals have been notified.",
                )
              }
            >
              Approve
            </button>
            <button
              className="secondary"
              disabled={busy || note.trim().length < 3}
              onClick={() =>
                void action(
                  { type: "decide", id: request.id, status: "rejected", note },
                  "Request rejected with your reason.",
                )
              }
            >
              Reject
            </button>
          </div>
        </>
      )}
      {user.role === "admin" &&
        request.status === "approved" &&
        ["issue", "permission"].includes(request.type) && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void action({
                type: "decide",
                id: request.id,
                status: request.type === "issue" ? "resolved" : "revoked",
                note:
                  request.type === "issue"
                    ? "Classroom issue resolved by administrator"
                    : "Unused permission revoked by administrator",
              })
            }
          >
            {request.type === "issue"
              ? "Mark resolved"
              : "Revoke unused permission"}
          </button>
        )}
    </article>
  );
}
export function Requests(props: FeatureProps & { kind?: Request["type"] }) {
  const [filter, setFilter] = useState("all");
  const requests = props.state.requests.filter(
    (r) =>
      (!props.kind || r.type === props.kind) &&
      (filter === "all" || r.status === filter),
  );
  return (
    <>
      <div className="toolbar">
        <label>
          Status
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {[
              "all",
              "pending",
              "approved",
              "rejected",
              "used",
              "resolved",
              "revoked",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <p className="muted">{requests.length} requests</p>
      </div>
      {requests.length ? (
        <div className="feature-cards">
          {requests.map((request) => (
            <RequestCard key={request.id} {...props} request={request} />
          ))}
        </div>
      ) : (
        <Empty
          title="No requests here"
          text="New reports and permission requests will appear here."
        />
      )}
    </>
  );
}
export function Reschedule({ state, action, busy }: FeatureProps) {
  const waiting = useMemo(
    () =>
      state.requests.filter(
        (r) =>
          r.type === "cancellation" &&
          r.status === "approved" &&
          r.makeup &&
          !state.extras.some((e) => e.id === "makeup-" + r.id),
      ),
    [state],
  );
  const options = useMemo(
    () =>
      waiting.map((request) => ({
        request,
        options: suggestions(
          state,
          state.sessions.find((s) => s.id === request.sessionId)!,
          request.date,
        ),
      })),
    [state, waiting],
  );
  return (
    <>
      <p className="info-note">
        Top three suggestions check faculty, section, room, seats and working
        facilities over the next 14 college days. Sundays and configured
        holidays are skipped. Confirmation rechecks the current sample records.
      </p>
      {options.map(({ request, options }) => (
        <section className="panel" key={request.id}>
          <h2>
            {state.sessions.find((s) => s.id === request.sessionId)?.subject}
          </h2>
          <p className="muted">
            Cancelled {request.date} · Reason: {request.reason}
          </p>
          <div className="suggestion-cards">
            {options.map((option, i) => (
              <article key={option.slot.date + option.slot.start}>
                <span className="eyebrow">
                  OPTION {i + 1} · SCORE {option.score}
                </span>
                <h3>{option.room.number}</h3>
                <strong>
                  {option.slot.date} · {option.slot.start}–{option.slot.end}
                </strong>
                <ul className="checklist">
                  {[
                    "Faculty free",
                    "Section free",
                    "Room free",
                    "Seats & facilities fit",
                  ].map((check) => (
                    <li key={check}>
                      <Check size={15} />
                      {check}
                    </li>
                  ))}
                </ul>
                <p className="muted small">{option.why}</p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      {
                        type: "makeup",
                        requestId: request.id,
                        roomId: option.room.id,
                        slot: option.slot,
                      },
                      "Makeup confirmed; the rep, faculty and students have been notified.",
                    )
                  }
                >
                  Confirm this slot
                </button>
              </article>
            ))}
          </div>
          {!options.length && (
            <p className="error-note">
              No room and slot satisfies all faculty, section, capacity and
              facility constraints. Keep this class awaiting review.
            </p>
          )}
        </section>
      ))}
      {!waiting.length && (
        <Empty
          title="No classes awaiting makeup"
          text="Approve a cancellation with Makeup class required to see suggestions here."
        />
      )}
      <section className="panel">
        <h2>Confirmed makeups</h2>
        {state.extras
          .filter((e) => e.kind === "makeup")
          .map((e) => (
            <article className="simple-row" key={e.id}>
              <strong>{e.title}</strong>
              <p>
                {e.date} · {e.start}–{e.end} ·{" "}
                {state.rooms.find((r) => r.id === e.roomId)?.number}
              </p>
              <Tag status="makeup" />
            </article>
          ))}
      </section>
    </>
  );
}
export function ChangeRoom({ state, action, busy }: FeatureProps) {
  const [id, setId] = useState("");
  const permissions = state.requests.filter(
    (r) =>
      r.type === "permission" &&
      r.status === "approved" &&
      r.expires &&
      Date.parse(r.expires) > Date.now(),
  );
  const permission = permissions.find((r) => r.id === id);
  const session = state.sessions.find((s) => s.id === permission?.sessionId);
  const slot =
    permission && session
      ? { date: permission.date, start: session.start, end: session.end }
      : null;
  const needs = useMemo(
    () =>
      session
        ? {
            seats: session.seats,
            resources: { projector: 1 },
            facultyId: session.facultyId,
            section: session.section,
            exclude: session.id,
            block: state.rooms.find((r) => r.id === session.roomId)?.block,
          }
        : undefined,
    [session, state.rooms],
  );
  const options =
    slot && needs
      ? rank(state, slot, needs)
          .filter((r) => !r.failures.length)
          .slice(0, 3)
      : [];
  return permissions.length ? (
    <>
      <section className="panel">
        <h2>Your approved permission</h2>
        <label>
          Choose the session
          <select value={id} onChange={(event) => setId(event.target.value)}>
            <option value="">Choose a single-use permission</option>
            {permissions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.date} ·{" "}
                {state.sessions.find((s) => s.id === p.sessionId)?.subject}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Changing the classroom consumes this permission. The recurring
          timetable is preserved.
        </p>
      </section>
      {slot && needs && (
        <>
          <div className="suggestion-cards">
            {options.map((o) => (
              <article key={o.room.id}>
                <span className="eyebrow">SUGGESTED · SCORE {o.score}</span>
                <h3>{o.room.number}</h3>
                <p className="muted small">{o.why}</p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      { type: "move", permissionId: id, roomId: o.room.id },
                      "Room changed for the approved date; permission consumed.",
                    )
                  }
                >
                  Choose this room
                </button>
              </article>
            ))}
          </div>
          <Rooms
            key={id}
            state={state}
            map
            fixedSlot={slot}
            needs={needs}
            choose={(room) => {
              void action(
                { type: "move", permissionId: id, roomId: room.id },
                "Classroom changed and permission consumed.",
              );
            }}
          />
        </>
      )}
    </>
  ) : (
    <Empty
      title="No active permission"
      text="Request permission and wait for your administrator’s approval before changing a classroom."
    />
  );
}
export function BookingForm({ state, action, busy }: FeatureProps) {
  const [date, setDate] = useState(today()),
    [start, setStart] = useState("16:00"),
    [end, setEnd] = useState("17:00");
  const [participants, setParticipants] = useState(40),
    [roomId, setRoomId] = useState(""),
    [projector, setProjector] = useState(true);
  const slot = { date, start, end };
  const valid = slotSchema.safeParse(slot);
  const needs = useMemo<Needs>(
    () => ({
      seats: participants,
      resources: { projector: projector ? 1 : 0 },
    }),
    [participants, projector],
  );
  const suitable = valid.success
    ? state.rooms.filter(
        (r) =>
          !rank({ ...state, rooms: [r] }, valid.data, needs)[0].failures.length,
      )
    : [];
  return (
    <>
      <section className="panel">
        <h2>Plan your next club event</h2>
        <p className="muted">
          Create the booking, print the Program Coordinator letter and upload a sample signed
          copy before admin review.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            void action(
              {
                type: "book",
                data: {
                  club: f.get("club"),
                  organizer: f.get("organizer"),
                  department: f.get("department"),
                  coordinator: f.get("coordinator"),
                  event: f.get("event"),
                  purpose: f.get("purpose"),
                  date,
                  start,
                  end,
                  participants,
                  roomId,
                  resources: needs.resources,
                },
              },
              "Booking created. Go to My Bookings to download the Program Coordinator letter.",
            );
          }}
        >
          <div className="form-grid">
            <FormField title="Club name" name="club" value="The Eye" />
            <FormField title="Organizer" name="organizer" value="Varsha" />
            <FormField
              title="Department"
              name="department"
              value="Computer Science and Engineering"
            />
            <FormField
              title="Faculty coordinator"
              name="coordinator"
              placeholder="Coordinator’s name"
            />
            <FormField
              title="Event name"
              name="event"
              placeholder="Name your event"
            />
            <label>
              Expected participants
              <input
                type="number"
                min={1}
                max={1000}
                value={participants}
                onChange={(event) =>
                  setParticipants(Number(event.target.value))
                }
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setRoomId("");
                }}
              />
            </label>
            <label>
              Start · IST
              <input
                type="time"
                value={start}
                onChange={(event) => {
                  setStart(event.target.value);
                  setRoomId("");
                }}
              />
            </label>
            <label>
              End · IST
              <input
                type="time"
                value={end}
                onChange={(event) => {
                  setEnd(event.target.value);
                  setRoomId("");
                }}
              />
            </label>
            <label>
              Available classroom
              <select
                required
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              >
                <option value="">Choose a suitable room</option>
                {suitable.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.number} · {room.capacity} seats
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Purpose
            <textarea
              name="purpose"
              required
              minLength={5}
              maxLength={800}
              rows={4}
              placeholder="Describe the event and its purpose…"
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={projector}
              onChange={(event) => setProjector(event.target.checked)}
            />
            Working projector required
          </label>
          <button className="primary" disabled={busy || !valid.success}>
            Create booking &amp; Program Coordinator letter
          </button>
        </form>
      </section>
      {valid.success && (
        <Rooms
          key={date + start + end}
          state={state}
          map
          fixedSlot={valid.data}
          needs={needs}
          choose={(room) => setRoomId(room.id)}
        />
      )}
    </>
  );
}
function BookingCard({
  booking,
  state,
  user,
  action,
  busy,
}: FeatureProps & { booking: Booking }) {
  const [note, setNote] = useState(""),
    [error, setError] = useState("");
  async function upload(file: File) {
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a PDF, JPG or PNG up to 2 MB.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    await action(
      {
        type: "booking",
        id: booking.id,
        action: "upload",
        file: { name: file.name, data, size: file.size, type: file.type },
      },
      "Signed letter submitted for admin review.",
    );
  }
  const room = state.rooms.find((r) => r.id === booking.roomId);
  return (
    <article className="panel request-card">
      <div className="panel-heading">
        <span className="eyebrow">{booking.reference}</span>
        <Tag status={booking.status} />
      </div>
      <h3>{booking.event}</h3>
      <p className="muted">
        {booking.club} · {booking.organizer}
      </p>
      <p>
        {booking.date} · {booking.start}–{booking.end} IST
      </p>
      <p>
        {room?.number} · {booking.participants} participants
      </p>
      <div className="reason-box">
        <strong>Purpose</strong>
        <p>{booking.purpose}</p>
      </div>
      <div className="actions">
        <button
          className="secondary"
          onClick={() => {
            void letter(booking, state).catch(() =>
              setError("Unable to create the PDF."),
            );
          }}
        >
          <FileText size={16} />
          Download Program Coordinator letter
        </button>
        <button
          className="text-link"
          onClick={() => {
            void navigator.clipboard
              .writeText(booking.reference)
              .catch(() => setError("Copy manually: " + booking.reference));
          }}
        >
          Copy reference
        </button>
      </div>
      {user.role === "club" && booking.status === "awaiting_hod_signature" && (
        <label className="upload-box">
          <Upload size={17} />
          Upload signed Program Coordinator letter
          <input
            type="file"
            disabled={busy}
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => {
              if (event.target.files?.[0])
                void upload(event.target.files[0]).catch(() =>
                  setError("Unable to read this file."),
                );
            }}
          />
          <small>PDF, JPG or PNG · up to 2 MB</small>
        </label>
      )}
      {booking.file && (
        <a
          href={booking.file.data}
          download={booking.file.name}
          className="text-link letter-download"
        >
          Download submitted letter: {booking.file.name}
        </a>
      )}
      {booking.note && <p>Admin decision: {booking.note}</p>}
      {user.role === "admin" &&
        booking.status === "signed_letter_submitted" && (
          <>
            <ul className="checklist">
              <li>
                <Check size={15} />
                Signed letter received
              </li>
              <li>
                <Check size={15} />
                Room capacity {room?.capacity}; needs {booking.participants}
              </li>
              <li>
                Current room status:{" "}
                {room
                  ? availability(state, room, booking).label
                  : "Missing room"}
              </li>
            </ul>
            <label>
              Decision note
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Approval note or rejection reason"
              />
            </label>
            <div className="actions">
              <button
                className="primary"
                disabled={busy || note.trim().length < 3}
                onClick={() =>
                  void action(
                    {
                      type: "booking",
                      id: booking.id,
                      action: "approve",
                      note,
                    },
                    "Availability rechecked. Booking approved.",
                  )
                }
              >
                Recheck &amp; approve
              </button>
              <button
                className="secondary"
                disabled={busy || note.trim().length < 3}
                onClick={() =>
                  void action(
                    { type: "booking", id: booking.id, action: "reject", note },
                    "Booking rejected with your reason.",
                  )
                }
              >
                Reject
              </button>
            </div>
            <Rooms state={state} map fixedSlot={booking} />
          </>
        )}
      {!["cancelled", "rejected"].includes(booking.status) &&
        (user.role === "admin" || booking.status !== "approved") && (
          <button
            className="danger-link"
            disabled={busy}
            onClick={() =>
              void action(
                { type: "booking", id: booking.id, action: "cancel" },
                "Booking cancelled.",
              )
            }
          >
            Cancel booking
          </button>
        )}
      <p className="error-note" role="alert">
        {error}
      </p>
    </article>
  );
}
export function Bookings(props: FeatureProps) {
  const [filter, setFilter] = useState("all");
  const bookings = props.state.bookings.filter(
    (b) => filter === "all" || b.status === filter,
  );
  return (
    <>
      <div className="toolbar">
        <label>
          Status
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {[
              "all",
              "awaiting_hod_signature",
              "signed_letter_submitted",
              "approved",
              "rejected",
              "cancelled",
            ].map((s) => (
              <option value={s} key={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">
          Request → Program Coordinator signature → Signed upload → Admin approval
        </p>
      </div>
      {bookings.length ? (
        <div className="feature-cards">
          {bookings.map((booking) => (
            <BookingCard {...props} booking={booking} key={booking.id} />
          ))}
        </div>
      ) : (
        <Empty
          title="No bookings yet"
          text="Club members can choose a room and create a booking request."
        />
      )}
    </>
  );
}
export function Classrooms({ state, action, busy }: FeatureProps) {
  const [room, setRoom] = useState<Room | null>(null);
  return (
    <>
      <div className="toolbar">
        <p className="muted">
          Manage capacities, working facilities and room status.
        </p>
        <button
          className="primary"
          onClick={() =>
            setRoom({
              id: crypto.randomUUID(),
              block: "A",
              floor: 0,
              number: "",
              capacity: 40,
              type: "lecture",
              active: true,
              resources: { projector: 1 },
            })
          }
        >
          Add classroom
        </button>
      </div>
      <Rooms state={state} edit={setRoom} />
      {room && (
        <div className="modal">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-room"
          >
            <h2 id="edit-room">
              {room.number ? "Edit " + room.number : "New classroom"}
            </h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action({ type: "room", room }, "Classroom saved.");
              }}
            >
              <div className="form-grid">
                <label>
                  Room number
                  <input
                    value={room.number}
                    required
                    onChange={(event) =>
                      setRoom({ ...room, number: event.target.value })
                    }
                  />
                </label>
                <label>
                  Block
                  <select
                    value={room.block}
                    onChange={(event) =>
                      setRoom({ ...room, block: event.target.value })
                    }
                  >
                    {blockIds.map((block) => (
                      <option key={block}>{block}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Floor
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={room.floor}
                    onChange={(event) =>
                      setRoom({ ...room, floor: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Seats
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={room.capacity}
                    onChange={(event) =>
                      setRoom({ ...room, capacity: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    value={room.type}
                    onChange={(event) =>
                      setRoom({
                        ...room,
                        type: event.target.value as Room["type"],
                      })
                    }
                  >
                    {["lecture", "lab", "computer_lab", "seminar"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                {facilities.map((name) => (
                  <label key={name}>
                    Working {name.replaceAll("_", " ")}
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={room.resources[name] ?? 0}
                      onChange={(event) =>
                        setRoom({
                          ...room,
                          resources: {
                            ...room.resources,
                            [name]: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={room.active}
                  onChange={(event) =>
                    setRoom({ ...room, active: event.target.checked })
                  }
                />
                Active room
              </label>
              <div className="actions">
                <button className="primary" disabled={busy}>
                  Save changes
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setRoom(null)}
                >
                  Close
                </button>
              </div>
            </form>
            <h3>Maintenance window</h3>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const f = new FormData(event.currentTarget);
                void action(
                  {
                    type: "maintenance",
                    roomId: room.id,
                    slot: {
                      date: String(f.get("date")),
                      start: String(f.get("start")),
                      end: String(f.get("end")),
                    },
                    reason: String(f.get("reason")),
                  },
                  "Maintenance block added for the selected date.",
                );
              }}
            >
              <div className="form-grid">
                <label>
                  Date
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={today()}
                  />
                </label>
                <label>
                  Start
                  <input
                    type="time"
                    name="start"
                    required
                    defaultValue="09:00"
                  />
                </label>
                <label>
                  End
                  <input type="time" name="end" required defaultValue="10:00" />
                </label>
                <FormField
                  title="Reason"
                  name="reason"
                  placeholder="Facility servicing"
                />
              </div>
              <button className="secondary" disabled={busy}>
                Block room for maintenance
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
export function Timetable({ state, user, action, busy, facultyView = false }: FeatureProps & { facultyView?: boolean }) {
  const [date, setDate] = useState(today()),
    [weekly, setWeekly] = useState(true),
    [filter, setFilter] = useState("");
  const [groupBy, setGroupBy] = useState<"section" | "faculty">(
    facultyView || user.role === "faculty" ? "faculty" : "section",
  );
  const [preview, setPreview] = useState<Session[]>([]),
    [error, setError] = useState("");
  const scope = state.sessions
    .filter(
      (s) =>
        user.role === "admin" ||
        (user.role === "faculty"
          ? (s.facultyId === user.facultyId || Boolean(state.staffPool?.some(p => p.staffName === user.name && p.section === s.section && s.courseCodes?.includes(p.courseCode))))
          : s.section === user.section),
    )
    .filter(
      (s) =>
        !filter ||
        [
          s.section,
          s.faculty,
          state.rooms.find((r) => r.id === s.roomId)?.number,
          s.subject,
        ]
          .join(" ")
          .toLowerCase()
          .includes(filter.toLowerCase()),
    );
  async function read(file: File) {
    setError("");
    setPreview([]);
    try {
      let rows: string[][];
      if (file.name.endsWith(".xlsx")) {
        const Excel = await import("exceljs");
        const workbook = new Excel.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        rows = [];
        workbook.worksheets[0]?.eachRow((r) =>
          rows.push(
            (r.values as unknown[]).slice(1).map((v) => String(v ?? "")),
          ),
        );
      } else {
        const { parseCSV } = await import("@/lib/import");
        rows = parseCSV(await file.text());
      }
      const headers = rows[0]?.map((name) => name.trim().toLowerCase());
      const expected = [
        "department",
        "year",
        "section",
        "subject",
        "faculty",
        "day",
        "start",
        "end",
        "room",
        "seats",
      ];
      if (!headers || expected.some((header) => !headers.includes(header)))
        throw new Error("Required columns: " + expected.join(", "));
      const incoming = rows
        .slice(1)
        .filter((row) => row.some(Boolean))
        .map((row, i) => {
          const cell = (name: string) => row[headers.indexOf(name)] ?? "";
          const room = state.rooms.find(
            (r) => r.number.toLowerCase() === cell("room").toLowerCase(),
          );
          if (!room) throw new Error(`Row ${i + 2}: unknown room.`);
          const known = state.sessions.find(
            (s) => s.faculty === cell("faculty"),
          );
          return {
            id: crypto.randomUUID(),
            department: cell("department"),
            year: Number(cell("year")),
            section: cell("section"),
            subject: cell("subject"),
            faculty: cell("faculty"),
            facultyId: known?.facultyId ?? state.faculty?.find((f) => f.name === cell("faculty"))?.id ?? "import-" + cell("faculty"),
            day: Number(cell("day")),
            start: cell("start"),
            end: cell("end"),
            roomId: room.id,
            seats: Number(cell("seats")),
          };
        });
      publish(state, user.role, incoming);
      setPreview(incoming);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    }
  }
  const daily = effectiveSessions(state, date, user).filter((s) =>
    scope.some((row) => row.id === s.id),
  );
  const dailyRows: TimetableRow[] = [
    ...daily.map((row) => ({ ...row, reason: row.override?.reason })),
    ...state.extras.filter((extra) =>
      extra.kind === "makeup" && extra.date === date &&
      (user.role === "admin" || (user.role === "faculty"
        ? extra.facultyId === user.facultyId
        : extra.section === user.section)),
    ).map((extra) => {
      const request = state.requests.find((r) => "makeup-" + r.id === extra.id);
      const original = state.sessions.find((s) => s.id === request?.sessionId);
      return {
        id: extra.id,
        day: new Date(date + "T12:00:00Z").getUTCDay(),
        start: extra.start, end: extra.end, roomId: extra.roomId,
        subject: extra.title, section: extra.section ?? original?.section ?? "Unassigned",
        facultyId: extra.facultyId ?? original?.facultyId ?? "",
        faculty: original?.faculty ?? state.sessions.find((s) => s.facultyId === extra.facultyId)?.faculty ?? "Unassigned",
        status: "makeup",
      };
    }).filter((row) => !filter || [row.subject, row.section, row.faculty,
      state.rooms.find((r) => r.id === row.roomId)?.number ?? ""].join(" ").toLowerCase().includes(filter.toLowerCase())),
  ];
  return (
    <>
      <div className="toolbar">
        {user.role === "admin" && (
          <label>
            Group timetable by
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as "section" | "faculty")}>
              <option value="section">Class</option>
              <option value="faculty">Faculty</option>
            </select>
          </label>
        )}
        <div className="tabs">
          <button
            className={!weekly ? "selected" : ""}
            onClick={() => setWeekly(false)}
          >
            Daily view
          </button>
          <button
            className={weekly ? "selected" : ""}
            onClick={() => setWeekly(true)}
          >
            Fixed weekly timetable
          </button>
        </div>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Search
          <input
            placeholder="Room, section, subject or faculty"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <button
          className="secondary"
          onClick={() =>
            download(
              "timetable.csv",
              csv([
                [
                  "day",
                  "subject",
                  "section",
                  "faculty",
                  "start",
                  "end",
                  "room",
                ],
                ...scope.map((s) => [
                  s.day,
                  s.subject,
                  s.section,
                  s.faculty,
                  s.start,
                  s.end,
                  state.rooms.find((r) => r.id === s.roomId)?.number,
                ]),
              ]),
            )
          }
        >
          <Download size={16} />
          Export
        </button>
      </div>
      <TimetableTables
        rows={weekly ? scope : dailyRows}
        state={state}
        weekly={weekly}
        groupBy={groupBy}
        date={date}
      />
      {groupBy === "faculty" && <FacultyPool state={state} query={filter} />}
      <p className="muted small">
        One-day cancellations and changes never overwrite the fixed recurring
        timetable.
      </p>
      {user.role === "admin" && (
        <section className="panel">
          <h2>Import and validate timetable</h2>
          <p className="muted">
            CSV or Excel (.xlsx). Day: 1–6 (Monday–Saturday). Times: HH:mm. All
            rows must pass validation before publication.
          </p>
          <button
            className="secondary"
            onClick={() =>
              download(
                "timetable-template.csv",
                "department,year,section,subject,faculty,day,start,end,room,seats\nCSE,2,CSE II A,Project Work,Dr. Meena,1,16:00,17:00,C-101,40\n",
              )
            }
          >
            Download CSV template
          </button>
          <label className="upload-box">
            Upload timetable
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => {
                if (event.target.files?.[0]) void read(event.target.files[0]);
              }}
            />
          </label>
          <p className="error-note" role="alert">
            {error}
          </p>
          {preview.length > 0 && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Section</th>
                      <th>Day</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.id}>
                        <td>{row.subject}</td>
                        <td>{row.section}</td>
                        <td>{row.day}</td>
                        <td>
                          {row.start}–{row.end}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void action(
                    { type: "publish", rows: preview },
                    "Validated timetable published.",
                  )
                }
              >
                Publish {preview.length} validated rows
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
}
export function Notifications({ state, user, save, demo = true }: FeatureProps) {
  const notifications = state.notifications.filter((n) =>
    n.roles.includes(user.role),
  );
  return (
    <>

      <div className="toolbar">
        <p className="muted">
          In-app updates show your requests and timetable changes.
        </p>
        <button
          className="secondary"
          onClick={() =>
            save({
              ...state,
              notifications: state.notifications.map((n) =>
                n.roles.includes(user.role)
                  ? { ...n, read: Array.from(new Set([...n.read, user.role])) }
                  : n,
              ),
            })
          }
        >
          Mark all read
        </button>
      </div>
      <section className="panel">
        {notifications.map((notice) => (
          <article className="notification-row" key={notice.id}>
            <span className="review-icon">
              <ClipboardCheck size={19} />
            </span>
            <div>
              <strong>{notice.title}</strong>
              <p>{notice.body}</p>
              <small>
                {new Date(notice.time).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </small>
              {(!demo || user.role === "admin") && (
                <p className="muted small">
                  WhatsApp: {demo ? "Demo — no message sent" : (notice.whatsappDelivery === "skipped_no_consent" ? "Not sent — no active consent or valid number" : notice.whatsappDelivery ?? "Not sent")}
                </p>
              )}
            </div>
            {!notice.read.includes(user.role) && <Tag status="unread" />}
          </article>
        ))}
        {!notifications.length && (
          <Empty
            title="No notifications yet"
            text="New decisions and changes will appear here."
          />
        )}
      </section>
    </>
  );
}
export function Reports({ state }: FeatureProps) {
  const [from, setFrom] = useState(nextDate(today(), -7)),
    [to, setTo] = useState(today());
  const requests = state.requests.filter((r) => r.date >= from && r.date <= to);
  const bookings = state.bookings.filter((b) => b.date >= from && b.date <= to);
  const chart = [9, 10, 11, 13, 14, 15, 16].map((hour) => ({
    time: `${hour}:00`,
    rooms: state.rooms.filter(
      (room) =>
        !availability(state, room, {
          date: to || today(),
          start: String(hour).padStart(2, "0") + ":00",
          end: String(hour + 1).padStart(2, "0") + ":00",
        }).free,
    ).length,
  }));
  return (
    <>
      <div className="toolbar">
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Until
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button
          className="secondary"
          onClick={() =>
            download(
              "campus-report.csv",
              csv([
                ["type", "date", "status", "description"],
                ...requests.map((r) => [r.type, r.date, r.status, r.reason]),
                ...bookings.map((b) => ["booking", b.date, b.status, b.event]),
              ]),
            )
          }
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>
      <div className="stat-grid">
        {[
          [
            "Cancellations",
            requests.filter((r) => r.type === "cancellation").length,
          ],
          [
            "Unresolved issues",
            requests.filter(
              (r) =>
                r.type === "issue" &&
                !["resolved", "rejected"].includes(r.status),
            ).length,
          ],
          [
            "Approved club bookings",
            bookings.filter((b) => b.status === "approved").length,
          ],
          [
            "Confirmed makeups",
            state.extras.filter(
              (e) => e.kind === "makeup" && e.date >= from && e.date <= to,
            ).length,
          ],
        ].map(([title, value]) => (
          <article key={title}>
            <div>
              <p>{title}</p>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Room occupancy by hour</h2>
        <p className="muted small">
          Sample occupancy on {to} · includes maintenance and inactive rooms
        </p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="rooms" fill="#4A6A9E" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <p className="info-note">
        This preview reports sample records. Walking-distance scoring, stability
        benchmarks and full live utilization analytics are pending real campus
        integration.
      </p>
    </>
  );
}
export function AuditLog({ state }: FeatureProps) {
  const [query, setQuery] = useState("");
  const items = state.audit.filter((item) =>
    (item.action + item.role).includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <label>
          Find an action
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Action or role"
          />
        </label>
        <button
          className="secondary"
          onClick={() =>
            download(
              "audit.csv",
              csv([
                ["time", "role", "action", "before", "after"],
                ...items.map((item) => [
                  item.time,
                  item.role,
                  item.action,
                  JSON.stringify(item.before),
                  JSON.stringify(item.after),
                ]),
              ]),
            )
          }
        >
          Export audit log
        </button>
      </div>
      <section className="panel">
        {items.map((item) => (
          <details className="audit-item" key={item.id}>
            <summary>
              <strong>{item.action.replaceAll("_", " ")}</strong>
              <Tag status={item.role} />
              <small>
                {new Date(item.time).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </small>
            </summary>
            <div>
              <section>
                <h4>Before</h4>
                <pre>{JSON.stringify(item.before, null, 2)}</pre>
              </section>
              <section>
                <h4>After</h4>
                <pre>{JSON.stringify(item.after, null, 2)}</pre>
              </section>
            </div>
          </details>
        ))}
        {!items.length && (
          <Empty
            title="No changes recorded"
            text="Saved campus actions create a history here."
          />
        )}
      </section>
    </>
  );
}

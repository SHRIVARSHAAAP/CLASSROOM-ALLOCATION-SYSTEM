import { z } from "zod";
import { validate } from "./engine";
import {
  slotSchema,
  type Booking,
  type Request,
  type Role,
  type Room,
  type Slot,
  type State,
} from "./types";

function authorize(role: Role, permitted: Role[]) {
  if (!permitted.includes(role))
    throw new Error("This action is not available in your portal.");
}
function record(
  state: State,
  role: Role,
  action: string,
  before: unknown,
  after: unknown,
  recipients: Role[],
  body: string,
): State {
  state.audit.unshift({
    id: crypto.randomUUID(),
    role,
    action,
    time: new Date().toISOString(),
    before: structuredClone(before),
    after: structuredClone(after),
  });
  if (recipients.length)
    state.notifications.unshift({
      id: crypto.randomUUID(),
      roles: recipients,
      title: action.replaceAll("_", " "),
      body,
      time: new Date().toISOString(),
      read: [],
      whatsapp: "skipped_no_consent",
    });
  return state;
}
const requestInput = z.object({
  type: z.enum(["cancellation", "issue", "permission"]),
  sessionId: z.string(),
  date: z.string(),
  reason: z.string().trim().min(5).max(1000),
});
export function report(
  state: State,
  role: Role,
  input: z.input<typeof requestInput>,
): State {
  authorize(role, ["rep"]);
  const data = requestInput.parse(input);
  slotSchema.parse({ date: data.date, start: "00:00", end: "23:59" });
  const session = state.sessions.find(
    (s) => s.id === data.sessionId && s.section === "CSE II A",
  );
  if (
    !session ||
    session.day !== new Date(data.date + "T12:00:00Z").getUTCDay()
  )
    throw new Error("Choose a class from your section on the selected date.");
  if (
    state.overrides.some(
      (o) => o.sessionId === session.id && o.date === data.date && o.cancelled,
    )
  )
    throw new Error("This class has already been cancelled.");
  if (
    state.requests.some(
      (r) =>
        r.type === data.type &&
        r.date === data.date &&
        r.sessionId === session.id &&
        ["pending", "approved"].includes(r.status),
    )
  )
    throw new Error("There is already an active request for this class.");
  const next = structuredClone(state);
  const request: Request = {
    ...data,
    id: crypto.randomUUID(),
    reporter: "CSE Class Rep",
    status: "pending",
  };
  next.requests.unshift(request);
  return record(
    next,
    role,
    data.type + "_reported",
    null,
    request,
    ["admin"],
    `${session.subject} · ${data.date}. Reason: ${data.reason}`,
  );
}
export function decide(
  state: State,
  role: Role,
  id: string,
  status: "approved" | "rejected" | "resolved" | "revoked",
  note: string,
  makeup = true,
): State {
  authorize(role, ["admin"]);
  if (note.trim().length < 3)
    throw new Error("Add a decision note of at least 3 characters.");
  const next = structuredClone(state);
  const request = next.requests.find((r) => r.id === id);
  if (!request) throw new Error("Request not found.");
  if (status === "resolved" || status === "revoked") {
    if (
      request.status !== "approved" ||
      (status === "resolved"
        ? request.type !== "issue"
        : request.type !== "permission")
    )
      throw new Error("This decision is not valid for the request.");
  } else if (request.status !== "pending")
    throw new Error("This request has already been reviewed.");
  const before = structuredClone(request);
  request.status = status;
  request.note = note;
  if (status === "approved" && request.type === "cancellation") {
    request.makeup = makeup;
    next.overrides = next.overrides.filter(
      (o) => !(o.sessionId === request.sessionId && o.date === request.date),
    );
    next.overrides.push({
      sessionId: request.sessionId,
      date: request.date,
      cancelled: true,
      reason: request.reason,
      reporter: request.reporter,
      approver: "Admin",
    });
  }
  if (status === "approved" && request.type === "permission")
    request.expires = new Date(Date.now() + 24 * 3600000).toISOString();
  return record(
    next,
    role,
    request.type + "_" + status,
    before,
    request,
    request.type === "cancellation" ? ["rep", "faculty", "student"] : ["rep"],
    `${request.date}. Reason: ${request.reason}. Admin: ${note}`,
  );
}
export function move(
  state: State,
  role: Role,
  permissionId: string,
  roomId: string,
): State {
  authorize(role, ["rep"]);
  const next = structuredClone(state);
  const permission = next.requests.find(
    (r) => r.id === permissionId && r.type === "permission",
  );
  if (
    !permission ||
    permission.status !== "approved" ||
    !permission.expires ||
    Date.parse(permission.expires) <= Date.now()
  )
    throw new Error("Permission is missing, expired or already used.");
  const session = next.sessions.find(
    (s) => s.id === permission.sessionId && s.section === "CSE II A",
  );
  const room = next.rooms.find((r) => r.id === roomId);
  if (!session || !room) throw new Error("Class or room not found.");
  if (
    next.overrides.some(
      (o) =>
        o.sessionId === session.id && o.date === permission.date && o.cancelled,
    )
  )
    throw new Error("A cancelled class cannot be moved.");
  const errors = validate(
    next,
    room,
    { date: permission.date, start: session.start, end: session.end },
    {
      seats: session.seats,
      resources: { projector: 1 },
      facultyId: session.facultyId,
      section: session.section,
      exclude: session.id,
    },
  );
  if (errors.length) throw new Error(errors.join("; "));
  const before = structuredClone(permission);
  next.overrides = next.overrides.filter(
    (o) => !(o.sessionId === session.id && o.date === permission.date),
  );
  next.overrides.push({
    sessionId: session.id,
    date: permission.date,
    roomId,
    reason: permission.reason,
    reporter: permission.reporter,
    approver: "Admin",
  });
  permission.status = "used";
  return record(
    next,
    role,
    "classroom_changed",
    before,
    { permission, roomId },
    ["admin", "rep", "faculty", "student"],
    `${session.subject} · ${permission.date} · new room ${room.number}`,
  );
}
export function makeup(
  state: State,
  role: Role,
  requestId: string,
  roomId: string,
  slot: Slot,
): State {
  authorize(role, ["admin"]);
  slotSchema.parse(slot);
  const next = structuredClone(state);
  const request = next.requests.find(
    (r) =>
      r.id === requestId &&
      r.type === "cancellation" &&
      r.status === "approved" &&
      r.makeup,
  );
  if (!request || next.extras.some((e) => e.id === "makeup-" + requestId))
    throw new Error("This class is not awaiting a makeup.");
  const session = next.sessions.find((s) => s.id === request.sessionId)!;
  const room = next.rooms.find((r) => r.id === roomId);
  if (!room) throw new Error("Room not found.");
  const errors = validate(next, room, slot, {
    seats: session.seats,
    resources: { projector: 1 },
    facultyId: session.facultyId,
    section: session.section,
  });
  if (errors.length) throw new Error(errors.join("; "));
  const event = {
    id: "makeup-" + requestId,
    ...slot,
    roomId,
    kind: "makeup" as const,
    title: session.subject,
    section: session.section,
    facultyId: session.facultyId,
  };
  next.extras.push(event);
  return record(
    next,
    role,
    "makeup_confirmed",
    null,
    event,
    ["rep", "faculty", "student"],
    `${session.subject} · ${slot.date} ${slot.start}–${slot.end} · ${room.number}. Original reason: ${request.reason}`,
  );
}
export const bookingInput = z.object({
  club: z.string().trim().min(2).max(100),
  organizer: z.string().trim().min(2).max(100),
  department: z.string().trim().min(2).max(100),
  coordinator: z.string().trim().min(2).max(100),
  event: z.string().trim().min(3).max(150),
  purpose: z.string().trim().min(5).max(800),
  date: z.string(),
  start: z.string(),
  end: z.string(),
  participants: z.coerce.number().int().min(1).max(1000),
  roomId: z.string(),
  resources: z.record(z.number().int().min(0)),
});
export function book(
  state: State,
  role: Role,
  input: z.input<typeof bookingInput>,
): State {
  authorize(role, ["club"]);
  const data = bookingInput.parse(input);
  slotSchema.parse(data);
  const room = state.rooms.find((r) => r.id === data.roomId);
  if (!room) throw new Error("Choose a classroom.");
  const errors = validate(state, room, data, {
    seats: data.participants,
    resources: data.resources,
  });
  if (errors.length) throw new Error(errors.join("; "));
  const next = structuredClone(state);
  next.counter++;
  const booking: Booking = {
    ...data,
    id: crypto.randomUUID(),
    reference: `CLUB-${data.date.slice(0, 4)}-${String(next.counter).padStart(4, "0")}`,
    status: "awaiting_hod_signature",
  };
  next.bookings.unshift(booking);
  return record(
    next,
    role,
    "booking_requested",
    null,
    booking,
    ["club"],
    `${booking.reference} · print the HOD letter and submit a sample signed copy for review.`,
  );
}
export function bookingAction(
  state: State,
  role: Role,
  id: string,
  action: "upload" | "approve" | "reject" | "cancel",
  note = "",
  file?: { name: string; data: string; size: number; type: string },
): State {
  authorize(
    role,
    action === "approve" || action === "reject"
      ? ["admin"]
      : action === "upload"
        ? ["club"]
        : ["club", "admin"],
  );
  const next = structuredClone(state);
  const booking = next.bookings.find((b) => b.id === id);
  if (!booking) throw new Error("Booking not found.");
  const before = {
    ...booking,
    file: booking.file ? { name: booking.file.name } : undefined,
  };
  if (action === "upload") {
    if (booking.status !== "awaiting_hod_signature")
      throw new Error("Booking is not awaiting a signature.");
    if (
      !file ||
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      file.size <= 0 ||
      file.size > 2 * 1024 * 1024
    )
      throw new Error("Choose a PDF, JPG or PNG up to 2 MB.");
    booking.file = { name: file.name, data: file.data };
    booking.status = "signed_letter_submitted";
  } else if (action === "approve" || action === "reject") {
    if (booking.status !== "signed_letter_submitted" || !booking.file)
      throw new Error("A signed letter must be submitted before review.");
    if (note.trim().length < 3) throw new Error("Add a decision reason.");
    if (action === "approve") {
      const room = next.rooms.find((r) => r.id === booking.roomId)!;
      const errors = validate(next, room, booking, {
        seats: booking.participants,
        resources: booking.resources,
      });
      if (errors.length) throw new Error(errors.join("; "));
    }
    booking.status = action === "approve" ? "approved" : "rejected";
    booking.note = note;
  } else {
    if (["cancelled", "rejected"].includes(booking.status))
      throw new Error("Booking is already closed.");
    if (booking.status === "approved" && role !== "admin")
      throw new Error("Ask the admin to cancel an approved booking.");
    booking.status = "cancelled";
  }
  return record(
    next,
    role,
    "booking_" + action,
    before,
    {
      ...booking,
      file: booking.file ? { name: booking.file.name } : undefined,
    },
    action === "upload" ? ["admin"] : ["club", "admin"],
    `${booking.reference} · ${booking.event}. ${note}`,
  );
}
export function editRoom(state: State, role: Role, room: Room): State {
  authorize(role, ["admin"]);
  const parsed = z
    .object({
      id: z.string(),
      block: z.string().min(1),
      number: z.string().trim().min(1).max(30),
      floor: z.number().int().min(0).max(20),
      capacity: z.number().int().min(1).max(1000),
      active: z.boolean(),
      type: z.enum(["lecture", "lab", "computer_lab", "seminar"]),
      resources: z.record(z.number().int().min(0).max(1000)),
    })
    .parse(room);
  if (state.rooms.some((r) => r.number === parsed.number && r.id !== parsed.id))
    throw new Error("Room number already exists.");
  const next = structuredClone(state);
  const before = next.rooms.find((r) => r.id === parsed.id) ?? null;
  next.rooms = before
    ? next.rooms.map((r) => (r.id === parsed.id ? parsed : r))
    : [...next.rooms, parsed];
  return record(next, role, "classroom_saved", before, parsed, [], "");
}

export function maintenance(
  state: State,
  role: Role,
  roomId: string,
  slot: Slot,
  reason: string,
): State {
  authorize(role, ["admin"]);
  slotSchema.parse(slot);
  if (
    !state.rooms.some((room) => room.id === roomId) ||
    reason.trim().length < 5
  )
    throw new Error("Choose a room and add a maintenance reason.");
  const next = structuredClone(state);
  const block = {
    id: crypto.randomUUID(),
    roomId,
    ...slot,
    kind: "maintenance" as const,
    title: reason,
  };
  next.extras.push(block);
  return record(
    next,
    role,
    "maintenance_created",
    null,
    block,
    ["admin", "rep", "faculty"],
    `Room ${state.rooms.find((room) => room.id === roomId)?.number} · ${slot.date}. ${reason}`,
  );
}
const sessionSchema = z.object({
  id: z.string(),
  day: z.number().int().min(1).max(6),
  start: z.string(),
  end: z.string(),
  roomId: z.string(),
  subject: z.string().trim().min(2),
  department: z.string().min(1),
  year: z.number().int().min(1).max(6),
  section: z.string().min(1),
  facultyId: z.string().min(1),
  faculty: z.string().min(1),
  seats: z.number().int().min(1).max(1000),
});
export function publish(state: State, role: Role, rows: unknown): State {
  authorize(role, ["admin"]);
  const sessions = z.array(sessionSchema).min(1).max(500).parse(rows);
  const next = structuredClone(state);
  for (const session of sessions) {
    const room = next.rooms.find((r) => r.id === session.roomId);
    if (!room) throw new Error("Unknown room for " + session.subject);
    const date = "2026-10-" + String(5 + session.day - 1).padStart(2, "0");
    const slot = slotSchema.parse({
      date,
      start: session.start,
      end: session.end,
    });
    // Recurring conflicts are checked independently of one-day cancellations.
    const recurring = { ...next, overrides: [], extras: [], bookings: [] };
    const errors = validate(recurring, room, slot, {
      seats: session.seats,
      resources: { projector: 1 },
      facultyId: session.facultyId,
      section: session.section,
    });
    if (errors.length)
      throw new Error(session.subject + ": " + errors.join("; "));
    next.sessions.push(session);
  }
  return record(
    next,
    role,
    "timetable_published",
    null,
    sessions,
    ["rep", "faculty", "student"],
    `${sessions.length} recurring sessions added. Dated changes are preserved.`,
  );
}

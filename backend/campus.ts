import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyAction, actionSchema } from "./actions";
import { AppError, demoMode, requireRole, sameOrigin, supabase } from "./auth";
import { failure } from "./http";
import { suggestions } from "@/lib/engine";
import { roleSchema, type Role, type State, type User } from "@/lib/types";

type Row = Record<string, unknown>;
const text = (row: Row | undefined, key: string) => String(row?.[key] ?? "");
const number = (row: Row | undefined, key: string) => Number(row?.[key] ?? 0);
const minuteTime = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const time = (row: Row, key: string) => text(row, key).slice(0, 5);
const roles: Role[] = ["admin", "rep", "club", "faculty", "student"];

async function readTable(table: string) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase(true).from(table).select("*").range(offset, offset + 999);
    if (result.error) throw new AppError(503, "Cannot read campus data. Apply db/live-integration.sql and check the Supabase settings.");
    rows.push(...(result.data as Row[]));
    if (result.data.length < 1000) break;
  }
  return rows;
}

export async function campusSnapshot() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await readTable("campus_revision");
    const names = ["users", "buildings", "class_sections", "classrooms", "classroom_resources",
      "timetable_versions", "timetable_sessions", "session_occurrences", "makeup_sessions",
      "cancellation_reports", "classroom_issues", "rep_permissions", "club_bookings",
      "maintenance_blocks", "notifications", "audit_logs", "campus_holidays"];
    const tables = await Promise.all(names.map(readTable));
    const data = Object.fromEntries(names.map((name, index) => [name, tables[index]]));
    const after = await readTable("campus_revision");
    if (number(before[0], "revision") !== number(after[0], "revision")) continue;
    const users = new Map(data.users.map((row) => [text(row, "id"), row]));
    const sections = new Map(data.class_sections.map((row) => [text(row, "id"), row]));
    const occurrences = new Map(data.session_occurrences.map((row) => [text(row, "id"), row]));
    const allSessions = new Map(data.timetable_sessions.map((row) => [text(row, "id"), row]));
    const versions = new Map(data.timetable_versions.map((row) => [text(row, "id"), row]));
    const published = new Set(data.timetable_versions.filter((v) => v.status === "published").map((v) => text(v, "id")));
    const resources = (id: string) => Object.fromEntries(data.classroom_resources.filter((r) => text(r, "classroom_id") === id).map((r) => [text(r, "resource_id"), number(r, "quantity_working")]));
    const state: State = {
      version: 1,
      rooms: data.classrooms.map((r) => ({
        id: text(r, "id"), block: text(r, "building_id"), floor: number(r, "floor"),
        number: text(r, "room_number"), capacity: number(r, "capacity"),
        type: r.room_type as State["rooms"][number]["type"], active: Boolean(r.is_active),
        resources: resources(text(r, "id")),
      })),
      sessions: data.timetable_sessions.filter((s) => published.has(text(s, "version_id"))).map((s) => ({
        id: text(s, "id"), day: number(s, "day_of_week"), start: minuteTime(number(s, "start_minute")),
        end: minuteTime(number(s, "end_minute")), roomId: text(s, "classroom_id"),
        subject: text(s, "subject"), section: text(s, "section_id"),
        department: text(sections.get(text(s, "section_id")), "department_id"),
        year: number(sections.get(text(s, "section_id")), "year"),
        facultyId: text(s, "faculty_id"), faculty: text(users.get(text(s, "faculty_id")), "name"),
        seats: number(sections.get(text(s, "section_id")), "size"),
        validFrom: text(versions.get(text(s, "version_id")), "effective_from"),
        validTo: text(versions.get(text(s, "version_id")), "effective_to"),
      })),
      overrides: data.session_occurrences.filter((o) => o.status !== "scheduled").map((o) => ({
        sessionId: text(o, "session_id"), date: text(o, "event_date"), cancelled: o.status === "cancelled",
        roomId: o.classroom_override ? text(o, "classroom_override") : undefined,
        reason: text(o, "reason"), reporter: text(users.get(text(o, "reported_by")), "name"),
        approver: text(users.get(text(o, "approved_by")), "name"),
      })),
      extras: [
        ...data.maintenance_blocks.map((r) => ({
          id: text(r, "id"), date: text(r, "event_date"), start: time(r, "start_time"),
          end: time(r, "end_time"), roomId: text(r, "classroom_id"), kind: "maintenance" as const, title: text(r, "reason"),
        })),
        ...data.makeup_sessions.map((r) => {
          const report = data.cancellation_reports.find((c) => text(c, "occurrence_id") === text(r, "occurrence_id"));
          return {
            id: report ? "makeup-" + text(report, "id") : text(r, "id"), date: text(r, "event_date"),
            start: time(r, "start_time"), end: time(r, "end_time"), roomId: text(r, "classroom_id"),
            kind: "makeup" as const, title: text(r, "subject"), facultyId: text(r, "faculty_id"), section: text(r, "section_id"),
          };
        }),
      ],
      requests: (["cancellation_reports", "classroom_issues", "rep_permissions"] as const).flatMap((table) =>
        data[table].map((r) => {
          const occurrence = occurrences.get(text(r, "occurrence_id"));
          return {
            id: text(r, "id"), type: table === "cancellation_reports" ? "cancellation" as const : table === "classroom_issues" ? "issue" as const : "permission" as const,
            sessionId: text(occurrence, "session_id"), date: text(occurrence, "event_date"),
            reason: text(r, table === "classroom_issues" ? "description" : "reason"),
            reporter: text(users.get(text(r, "rep_id")), "name"), status: r.status as State["requests"][number]["status"],
            note: text(r, "decision_note") || undefined, expires: text(r, "expires_at") || undefined,
            makeup: Boolean(r.makeup_required),
          };
        })),
      bookings: data.club_bookings.map((r) => ({
        id: text(r, "id"), reference: text(r, "reference"), club: text(r, "club"), organizer: text(r, "organizer"),
        department: text(r, "department"), coordinator: text(r, "coordinator"), event: text(r, "event"),
        purpose: text(r, "purpose"), date: text(r, "event_date"), start: time(r, "start_time"), end: time(r, "end_time"),
        participants: number(r, "participants"), roomId: text(r, "classroom_id"),
        resources: r.required_resources as Record<string, number>, status: r.status as State["bookings"][number]["status"],
        file: r.signed_letter_path ? { name: text(r, "signed_letter_name") || "Signed letter", data: "" } : undefined,
        note: text(r, "decision_note") || undefined,
      })),
      notifications: data.notifications.map((r) => ({
        id: text(r, "id"), roles: [roleSchema.parse(users.get(text(r, "user_id"))?.role)],
        title: text(r, "title"), body: text(r, "body"), time: text(r, "created_at"),
        read: r.read_at ? [roleSchema.parse(users.get(text(r, "user_id"))?.role)] : [], whatsapp: "skipped_no_consent",
      })),
      audit: data.audit_logs.map((r) => ({
        id: text(r, "id"), role: roleSchema.parse(users.get(text(r, "actor_id"))?.role ?? "admin"),
        action: text(r, "action"), time: text(r, "created_at"), before: r.before_value, after: r.after_value,
      })),
      counter: data.club_bookings.reduce((max, b) => Math.max(max, Number(text(b, "reference").split("-").at(-1)) || 0), 0),
      holidays: data.campus_holidays.map((r) => text(r, "event_date")),
      faculty: data.users.filter((u) => u.role === "faculty" && u.is_active).map((u) => ({ id: text(u, "id"), name: text(u, "name") })),
      sections: data.class_sections.map((s) => ({ id: text(s, "id"), department: text(s, "department_id"), year: number(s, "year"), size: number(s, "size") })),
      catalog: { blockCount: data.buildings.length, sectionCount: data.class_sections.length },
    };
    return { state, revision: number(after[0], "revision"), data, allSessions, users };
  }
  throw new AppError(409, "Campus data changed. Please retry.");
}

function scoped(snapshot: Awaited<ReturnType<typeof campusSnapshot>>, user: User): State {
  const { state, data } = snapshot;
  if (user.role === "admin") return {
    ...state, notifications: state.notifications.filter((n) => data.notifications.find((r) => text(r, "id") === n.id)?.user_id === user.id),
  };
  const ownsSession = (id: string) => state.sessions.some((s) => s.id === id && (
    user.role === "faculty" ? s.facultyId === user.id : s.section === user.section
  ));
  const ownRequest = new Set(["cancellation_reports", "classroom_issues", "rep_permissions"].flatMap((table) =>
    data[table].filter((r) => r.rep_id === user.id).map((r) => text(r, "id")),
  ));
  // Other classes retain only anonymous occupancy needed by the room map.
  const sessions = state.sessions.map((s) => ownsSession(s.id) ? s : ({
    ...s, subject: "Scheduled class", faculty: "", facultyId: "", section: "", department: "", year: 0, seats: 0,
  })).filter((s) => user.role !== "student" || ownsSession(s.id));
  const bookings = state.bookings.filter((b) => data.club_bookings.find((r) => text(r, "id") === b.id)?.organizer_id === user.id);
  const otherBookings = state.bookings.filter((b) => b.status === "approved" && !bookings.some((own) => own.id === b.id)).map((b) => ({
    id: b.id, date: b.date, start: b.start, end: b.end, roomId: b.roomId, kind: "club" as const, title: "Approved club booking",
  }));
  return {
    ...state, faculty: undefined, sections: undefined, sessions, audit: [], requests: state.requests.filter((r) => ownRequest.has(r.id)), bookings,
    overrides: state.overrides.map((o) => ownsSession(o.sessionId) ? o : ({ ...o, reason: "", reporter: "", approver: "" })),
    extras: [...state.extras.map((e) => e.kind === "makeup" && (
      user.role === "faculty" ? e.facultyId !== user.id : e.section !== user.section
    ) ? { ...e, title: "Makeup class", facultyId: undefined, section: undefined } : e), ...otherBookings],
    notifications: state.notifications.filter((n) => data.notifications.find((r) => text(r, "id") === n.id)?.user_id === user.id),
  };
}

async function response(snapshot: Awaited<ReturnType<typeof campusSnapshot>>, user: User) {
  const state = scoped(snapshot, user);
  for (const booking of state.bookings) {
    const row = snapshot.data.club_bookings.find((r) => text(r, "id") === booking.id);
    if (row?.signed_letter_path && booking.file) {
      const signed = await supabase(true).storage.from("campus-private").createSignedUrl(text(row, "signed_letter_path"), 300);
      if (!signed.error) booking.file.data = signed.data.signedUrl;
    }
  }
  return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
}

export async function liveRead() {
  try {
    if (demoMode()) throw new AppError(403, "Real campus data is disabled while demo mode is enabled.");
    const user = await requireRole(roles);
    return await response(await campusSnapshot(), user);
  } catch (error) { return failure(error); }
}

export async function liveAction(request: Request) {
  let uploaded: string | undefined;
  let committed = false;
  try {
    sameOrigin(request);
    if (demoMode()) throw new AppError(403, "Real actions are disabled while demo mode is enabled.");
    const user = await requireRole(roles);
    const raw = await request.text();
    if (raw.length > 3_000_000) throw new AppError(413, "Upload must be under 2 MB.");
    const input = z.object({ action: actionSchema }).strict().parse(JSON.parse(raw));
    const action = input.action;
    const snapshot = await campusSnapshot();
    const state = snapshot.state;
    if (user.role === "rep") {
      const sessionId = action.type === "report" ? action.sessionId : action.type === "move" ? state.requests.find((r) => r.id === action.permissionId)?.sessionId : undefined;
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session || !user.section || session.section !== user.section) throw new AppError(403, "This class is not assigned to your section.");
      if (action.type === "move" && !snapshot.data.rep_permissions.some((r) => r.id === action.permissionId && r.rep_id === user.id)) throw new AppError(403, "This permission belongs to another representative.");
    }
    if (user.role === "club") {
      if (!user.clubPermission) throw new AppError(403, "Ask your administrator to enable club booking permission.");
      if (action.type === "booking" && !snapshot.data.club_bookings.some((r) => r.id === action.id && r.organizer_id === user.id)) throw new AppError(403, "This booking belongs to another organizer.");
    }
    if (action.type === "booking" && action.action === "upload") {
      const file = action.file;
      if (!file || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) throw new AppError(400, "Choose a PDF, JPG or PNG.");
      const encoded = file.data.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
      if (!encoded || encoded[1] !== file.type) throw new AppError(400, "Invalid upload.");
      const bytes = Buffer.from(encoded[2], "base64");
      const isPdf = bytes.subarray(0, 5).toString() === "%PDF-";
      const isPng = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const isJpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.length !== file.size ||
        !(file.type === "application/pdf" ? isPdf : file.type === "image/png" ? isPng : isJpg)) throw new AppError(400, "Invalid file or file exceeds 2 MB.");
      uploaded = user.id + "/" + action.id + "/" + crypto.randomUUID();
      const saved = await supabase(true).storage.from("campus-private").upload(uploaded, bytes, { contentType: file.type, upsert: false });
      if (saved.error) throw new AppError(503, "Cannot save the letter. Check private storage configuration.");
    }
    if (action.type === "makeup") {
      const report = state.requests.find((r) => r.id === action.requestId);
      const session = state.sessions.find((s) => s.id === report?.sessionId);
      if (!report || !session || !suggestions(state, session, report.date).some((option) =>
        option.room.id === action.roomId && option.slot.date === action.slot.date &&
        option.slot.start === action.slot.start && option.slot.end === action.slot.end
      )) throw new AppError(409, "This suggestion has changed. Refresh and choose a current slot.");
    }
    const result = await applyAction(state, user.role, action, user);
    const patch: Record<string, unknown> = { type: action.type };
    const changed = <T extends { id: string }>(next: T[], old: T[]) => next.filter((n) => JSON.stringify(n) !== JSON.stringify(old.find((o) => o.id === n.id)));
    if (action.type === "room") patch.rooms = changed(result.rooms, state.rooms);
    if (action.type === "publish") {
      patch.sessions = result.sessions.filter((s) => !state.sessions.some((old) => old.id === s.id)).map((s) => ({
        ...s, startMinute: minutes(s.start), endMinute: minutes(s.end),
      }));
      for (const s of patch.sessions as State["sessions"]) {
        const section = snapshot.data.class_sections.find((r) => r.id === s.section);
        const room = state.rooms.find((r) => r.id === s.roomId);
        if (!room || room.capacity < number(section, "size")) throw new AppError(400, "The room cannot seat the entire class section.");
        if (!snapshot.users.has(s.facultyId) || snapshot.users.get(s.facultyId)?.role !== "faculty" || !snapshot.data.class_sections.some((r) => r.id === s.section)) throw new AppError(400, "Create the class section and faculty account before importing its timetable.");
      }
    }
    if (["report", "decide", "move"].includes(action.type)) patch.requests = changed(result.requests, state.requests);
    if (action.type === "decide" || action.type === "move") patch.overrides = result.overrides.filter((n) =>
      JSON.stringify(n) !== JSON.stringify(state.overrides.find((o) => o.sessionId === n.sessionId && o.date === n.date)),
    );
    if (action.type === "makeup" || action.type === "maintenance") patch.extras = changed(result.extras, state.extras);
    if (action.type === "book" || action.type === "booking") {
      patch.bookings = changed(result.bookings, state.bookings).map((b) => ({ ...b, file: undefined }));
      if (uploaded && action.type === "booking") {
        patch.upload = { bookingId: action.id, path: uploaded, name: action.file?.name };
      }
    }
    patch.audit = result.audit[0];
    patch.notice = result.notifications[0]?.id !== state.notifications[0]?.id ? result.notifications[0] : null;
    const target = action.type === "report" ? state.sessions.find((s) => s.id === action.sessionId) :
      action.type === "move" ? state.sessions.find((s) => s.id === state.requests.find((r) => r.id === action.permissionId)?.sessionId) :
      action.type === "decide" || action.type === "makeup" ? state.sessions.find((s) => s.id === state.requests.find((r) => r.id === (action.type === "decide" ? action.id : action.requestId))?.sessionId) : undefined;
    patch.targetSection = target?.section;
    patch.targetFaculty = target?.facultyId;
    const write = await supabase(true).rpc("campus_commit_change", {
      actor_id: user.id, expected_revision: snapshot.revision, change: patch,
    });
    if (write.error) throw new AppError(409, "The change was not saved. Data may have changed, a room may be occupied, or the database update is missing. Refresh and retry.");
    committed = true;
    return await response(await campusSnapshot(), user);
  } catch (error) {
    if (uploaded && !committed) await supabase(true).storage.from("campus-private").remove([uploaded]);
    return failure(error);
  }
}

export async function markRead(request: Request) {
  try {
    sameOrigin(request);
    if (demoMode()) throw new AppError(403, "Real notifications are disabled.");
    const user = await requireRole(roles);
    const result = await supabase(true).from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if (result.error) throw new AppError(503, "Cannot mark notifications read.");
    return await response(await campusSnapshot(), user);
  } catch (error) { return failure(error); }
}

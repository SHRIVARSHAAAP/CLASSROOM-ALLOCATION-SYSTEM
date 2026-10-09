import { describe, expect, it } from "vitest";
import { availability, blockers, overlap } from "../lib/availability";
import { baseline, rank, score, suggestions, validate } from "../lib/engine";
import { parseCSV } from "../lib/import";
import { csv } from "../lib/files";
import { seed } from "../lib/sample";
import {
  bookingAction,
  book,
  decide,
  makeup,
  move,
  publish,
  report,
} from "../lib/workflows";
import { nextDate, slotSchema } from "../lib/types";

const date = "2026-10-09";
const state = () => seed(date);
function target() {
  const s = state();
  const session = s.sessions.find(
    (row) => row.day === 5 && row.section === "CSE II A",
  )!;
  return {
    state: s,
    session,
    room: s.rooms.find((r) => r.id === session.roomId)!,
    slot: { date, start: session.start, end: session.end },
  };
}
function booking(roomId: string) {
  return {
    club: "The Eye",
    organizer: "Varsha",
    coordinator: "Dr. Meena",
    department: "CSE",
    event: "Cyber Lock",
    purpose: "A student cybersecurity event",
    date,
    start: "17:00",
    end: "18:00",
    roomId,
    participants: 40,
    resources: { projector: 1 },
  };
}

describe("shared availability", () => {
  it("uses half-open intervals so adjacent classes do not conflict", () => {
    expect(
      overlap(
        { start: "09:00", end: "10:00" },
        { start: "10:00", end: "11:00" },
      ),
    ).toBe(false);
    expect(
      overlap(
        { start: "09:00", end: "10:00" },
        { start: "09:59", end: "11:00" },
      ),
    ).toBe(true);
  });
  it("rejects invalid dates and backwards slots", () => {
    expect(() =>
      slotSchema.parse({ date: "2026-02-30", start: "09:00", end: "10:00" }),
    ).toThrow();
    expect(() =>
      slotSchema.parse({ date, start: "10:00", end: "09:00" }),
    ).toThrow();
  });
  it("releases a cancelled class only for that date", () => {
    const t = target();
    const request = t.state.requests.find((r) => r.type === "cancellation")!;
    const cancelled = decide(
      t.state,
      "admin",
      request.id,
      "approved",
      "Faculty meeting confirmed",
    );
    expect(availability(cancelled, t.room, t.slot)).toEqual({
      free: true,
      label: "Available",
      reason: "Class cancelled, room released",
    });
    expect(
      availability(cancelled, t.room, { ...t.slot, date: nextDate(date, 7) })
        .free,
    ).toBe(false);
    expect(cancelled.sessions).toEqual(t.state.sessions);
    expect(cancelled.notifications[0].body).toContain(request.reason);
  });
  it("working facility quantities and capacity are hard constraints", () => {
    const t = target();
    const invalid = { ...t.room, capacity: 20, resources: { projector: 0 } };
    expect(
      validate(
        t.state,
        invalid,
        { date, start: "17:00", end: "18:00" },
        { seats: 40, resources: { projector: 1 } },
      ),
    ).toHaveLength(2);
  });
  it("detects faculty and section clashes even in a different room", () => {
    const t = target();
    const room = t.state.rooms.find((r) => r.id === "Y-1")!;
    expect(
      validate(t.state, room, t.slot, {
        seats: 40,
        resources: { projector: 1 },
        facultyId: t.session.facultyId,
        section: t.session.section,
      }),
    ).toEqual(["Faculty busy", "Section busy"]);
    expect(
      blockers(t.state, t.slot, { facultyId: t.session.facultyId }),
    ).toHaveLength(1);
  });
});

describe("permissions and read-only roles", () => {
  it("faculty, student and club users cannot report cancellation", () => {
    const t = target();
    for (const role of ["faculty", "student", "club"] as const)
      expect(() =>
        report(t.state, role, {
          type: "cancellation",
          date,
          sessionId: t.session.id,
          reason: "A real reason",
        }),
      ).toThrow("not available");
  });
  it("rep is restricted to their own section", () => {
    const t = target();
    const other = t.state.sessions.find(
      (s) => s.day === 5 && s.section === "IT II A",
    )!;
    expect(() =>
      report(t.state, "rep", {
        type: "issue",
        date,
        sessionId: other.id,
        reason: "Projector failure",
      }),
    ).toThrow("your section");
  });
  it("approved permission is session-bound and single-use", () => {
    const t = target();
    const request = t.state.requests.find((r) => r.type === "permission")!;
    let changed = decide(
      t.state,
      "admin",
      request.id,
      "approved",
      "Approved for this session",
    );
    const destination = rank(changed, t.slot, {
      seats: 40,
      resources: { projector: 1 },
      facultyId: t.session.facultyId,
      section: t.session.section,
      exclude: t.session.id,
    }).find((r) => !r.failures.length && r.room.id !== t.room.id)!.room;
    changed = move(changed, "rep", request.id, destination.id);
    expect(changed.requests.find((r) => r.id === request.id)?.status).toBe(
      "used",
    );
    expect(changed.sessions).toEqual(t.state.sessions);
    expect(() => move(changed, "rep", request.id, destination.id)).toThrow(
      "already used",
    );
    expect(changed.overrides[0]).toMatchObject({
      sessionId: t.session.id,
      date,
      roomId: destination.id,
    });
  });
  it("expired permission is rejected", () => {
    const t = target();
    const request = t.state.requests.find((r) => r.type === "permission")!;
    const changed = decide(
      t.state,
      "admin",
      request.id,
      "approved",
      "Approved once",
    );
    changed.requests.find((r) => r.id === request.id)!.expires =
      "2000-01-01T00:00:00Z";
    expect(() => move(changed, "rep", request.id, "Y-1")).toThrow("expired");
  });
  it("a rep cannot approve their own report", () => {
    expect(() =>
      decide(state(), "rep", "sample-cancellation", "approved", "Approve it"),
    ).toThrow("not available");
  });
});

describe("makeups and allocation", () => {
  it("ranks a fitting room above a first-fit oversized hall", () => {
    const s = state();
    const fit = s.rooms.find(
      (r) => r.capacity === 40 && r.resources.projector > 0,
    )!;
    const hall = { ...fit, id: "hall", capacity: 200 };
    const example = { ...s, sessions: [], extras: [], rooms: [hall, fit] };
    const needs = { seats: 40, resources: { projector: 1 }, block: fit.block };
    const slot = { date, start: "17:00", end: "18:00" };
    expect(rank(example, slot, needs)[0].room.id).toBe(fit.id);
    expect(score(fit, needs)).toBeGreaterThan(
      score(baseline(example, slot, needs)!, needs),
    );
  });
  it("provides checked suggestions and rejects duplicate makeup confirmation", () => {
    const t = target();
    const request = t.state.requests.find((r) => r.type === "cancellation")!;
    const cancelled = decide(
      t.state,
      "admin",
      request.id,
      "approved",
      "Makeup required",
      true,
    );
    const options = suggestions(cancelled, t.session, date);
    expect(options).toHaveLength(3);
    const option = options[0];
    const confirmed = makeup(
      cancelled,
      "admin",
      request.id,
      option.room.id,
      option.slot,
    );
    expect(availability(confirmed, option.room, option.slot).free).toBe(false);
    expect(() =>
      makeup(confirmed, "admin", request.id, option.room.id, option.slot),
    ).toThrow("not awaiting");
  });
  it("timetable import checks recurring conflicts even when one occurrence is cancelled", () => {
    const t = target();
    const cancelled = decide(
      t.state,
      "admin",
      "sample-cancellation",
      "approved",
      "Cancel one date",
    );
    expect(() =>
      publish(cancelled, "admin", [{ ...t.session, id: "duplicate" }]),
    ).toThrow("occupied");
  });
});

describe("club booking approval", () => {
  it("requires a signed letter and rechecks room availability during approval", () => {
    let s = state();
    const room = s.rooms.find((r) => r.id === "D-1")!;
    s = book(s, "club", booking(room.id));
    const first = s.bookings[0];
    expect(() =>
      bookingAction(s, "admin", first.id, "approve", "Approved"),
    ).toThrow("signed letter");
    const file = {
      name: "sample.pdf",
      data: "data:application/pdf;base64,JVBERi0=",
      type: "application/pdf",
      size: 100,
    };
    s = bookingAction(s, "club", first.id, "upload", "", file);
    s = book(s, "club", booking(room.id));
    const second = s.bookings[0];
    s = bookingAction(s, "club", second.id, "upload", "", file);
    s = bookingAction(s, "admin", first.id, "approve", "Approved by admin");
    expect(() =>
      bookingAction(s, "admin", second.id, "approve", "Approved too"),
    ).toThrow("occupied");
    expect(availability(s, room, first).free).toBe(false);
    s = bookingAction(s, "admin", first.id, "cancel");
    expect(availability(s, room, first).free).toBe(true);
  });
  it("rejects unsafe uploads and student booking attempts", () => {
    const s = state();
    expect(() =>
      bookingAction(s, "club", "sample-booking", "upload", "", {
        name: "bad.exe",
        type: "application/octet-stream",
        data: "data:bad",
        size: 50,
      }),
    ).toThrow("PDF");
    expect(() => book(s, "student", booking("D-1"))).toThrow("not available");
  });
});

describe("sample and exports", () => {
  it("has fifty uniquely numbered rooms in every one of thirteen blocks", () => {
    const s = state();
    expect(new Set(s.rooms.map((r) => r.number)).size).toBe(650);
    for (const block of new Set(s.rooms.map((r) => r.block)))
      expect(s.rooms.filter((r) => r.block === block)).toHaveLength(50);
  });
  it("handles commas in CSV fields and prevents exported formulas", () => {
    expect(parseCSV('a,b\n"a,b","a""b"')).toEqual([
      ["a", "b"],
      ["a,b", 'a"b'],
    ]);
    expect(csv([["=SUM(A1)", "normal"]])).toContain("'=SUM(A1)");
  });
});

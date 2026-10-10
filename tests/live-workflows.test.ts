import { describe, expect, it } from "vitest";
import { seed } from "../lib/sample";
import { report, decide, move } from "../lib/workflows";
import { suggestions, rank } from "../lib/engine";

describe("real account workflow identity", () => {
  it("uses the representative's assigned section and real name", () => {
    const state = seed("2026-10-12");
    const session = state.sessions.find((s) => s.day === 1 && s.section === "IT II A")!;
    const changed = report(state, "rep", {
      type: "permission", sessionId: session.id, date: "2026-10-12", reason: "Need another classroom",
    }, "IT II A", "IT representative");
    const request = changed.requests[0];
    expect(request.reporter).toBe("IT representative");
    const approved = decide(changed, "admin", request.id, "approved", "Approved for this session");
    const slot = { date: request.date, start: session.start, end: session.end };
    const room = rank(approved, slot, {
      seats: session.seats, resources: { projector: 1 }, facultyId: session.facultyId,
      section: session.section, exclude: session.id,
    }).find((candidate) => !candidate.failures.length && candidate.room.id !== session.roomId)!.room;
    const moved = move(approved, "rep", request.id, room.id, "IT II A");
    expect(moved.requests[0].status).toBe("used");
    expect(moved.sessions).toEqual(state.sessions);
    expect(() => report(state, "rep", {
      type: "issue", sessionId: session.id, date: request.date, reason: "Projector has failed",
    }, "CSE II A", "Other rep")).toThrow("your section");
  });
  it("preserves a two-hour class duration in every suggested makeup", () => {
    const state = seed("2026-10-12");
    const session = { ...state.sessions[0], start: "09:00", end: "11:00" };
    state.sessions = [];
    const options = suggestions(state, session, "2026-10-12");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
      expect(minutes(option.slot.end) - minutes(option.slot.start)).toBe(120);
    }
  });
});

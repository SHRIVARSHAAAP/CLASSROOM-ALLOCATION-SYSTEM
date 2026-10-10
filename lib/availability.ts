import {
  slotSchema,
  type Extra,
  type Room,
  type Slot,
  type State,
} from "./types";
export function overlap(
  a: Pick<Slot, "start" | "end">,
  b: Pick<Slot, "start" | "end">,
): boolean {
  return a.start < b.end && b.start < a.end;
}
export function occupancy(state: State, date: string): Extra[] {
  slotSchema.parse({ date, start: "00:00", end: "23:59" });
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  const recurring: Extra[] = state.sessions
    .filter((s) => s.day === day && !state.holidays.includes(date) && (!s.validFrom || date >= s.validFrom) && (!s.validTo || date <= s.validTo))
    .flatMap((session) => {
      const change = state.overrides.find(
        (o) => o.sessionId === session.id && o.date === date,
      );
      if (change?.cancelled) return [];
      return [
        {
          id: session.id,
          date,
          start: session.start,
          end: session.end,
          roomId: change?.roomId ?? session.roomId,
          kind: "regular" as const,
          section: session.section,
          facultyId: session.facultyId,
          title: `${session.subject} · ${session.section}`,
        },
      ];
    });
  const clubs = state.bookings
    .filter((b) => b.status === "approved" && b.date === date)
    .map((b) => ({
      id: b.id,
      date,
      start: b.start,
      end: b.end,
      roomId: b.roomId,
      kind: "club" as const,
      title: b.event,
    }));
  return [
    ...recurring,
    ...state.extras.filter((e) => e.date === date),
    ...clubs,
  ];
}
export function blockers(
  state: State,
  slot: Slot,
  target: {
    roomId?: string;
    facultyId?: string;
    section?: string;
    exclude?: string;
  },
): Extra[] {
  slotSchema.parse(slot);
  return occupancy(state, slot.date).filter(
    (event) =>
      event.id !== target.exclude &&
      overlap(slot, event) &&
      (event.roomId === target.roomId ||
        (target.facultyId && event.facultyId === target.facultyId) ||
        (target.section && event.section === target.section)),
  );
}
export function availability(
  state: State,
  room: Room,
  slot: Slot,
): { free: boolean; reason: string; label: "Available" | "Not available" } {
  if (!room.active)
    return { free: false, label: "Not available", reason: "Inactive room" };
  const occupied = blockers(state, slot, { roomId: room.id });
  if (occupied.length) {
    const item = occupied[0];
    const regular = state.sessions.some((s) => s.id === item.id);
    return {
      free: false,
      label: "Not available",
      reason: `${regular ? "Regular class" : item.kind === "club" ? "Approved club booking" : item.kind === "maintenance" ? "Maintenance" : "Makeup"} · ${item.title}`,
    };
  }
  const released = state.overrides.some(
    (o) =>
      o.date === slot.date &&
      o.cancelled &&
      state.sessions.some(
        (s) => s.id === o.sessionId && s.roomId === room.id && overlap(slot, s),
      ),
  );
  return {
    free: true,
    label: "Available",
    reason: released
      ? "Class cancelled, room released"
      : "Free for the full selected period",
  };
}

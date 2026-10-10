import { blockers } from "../availability";
import {
  nextDate,
  type Room,
  type Session,
  type Slot,
  type State,
} from "../types";
export type Needs = {
  seats: number;
  resources: Record<string, number>;
  facultyId?: string;
  section?: string;
  exclude?: string;
  block?: string;
};
export function validate(
  state: State,
  room: Room,
  slot: Slot,
  needs: Needs,
): string[] {
  const failures: string[] = [];
  if (!room.active) failures.push("Inactive room");
  if (room.capacity < needs.seats)
    failures.push(`Needs ${needs.seats} seats; room has ${room.capacity}`);
  for (const [name, count] of Object.entries(needs.resources))
    if ((room.resources[name] ?? 0) < count)
      failures.push(`Insufficient working ${name.replaceAll("_", " ")}`);
  const conflicts = blockers(state, slot, {
    roomId: room.id,
    facultyId: needs.facultyId,
    section: needs.section,
    exclude: needs.exclude,
  });
  if (conflicts.some((c) => c.roomId === room.id))
    failures.push("Room occupied");
  if (needs.facultyId && conflicts.some((c) => c.facultyId === needs.facultyId))
    failures.push("Faculty busy");
  if (needs.section && conflicts.some((c) => c.section === needs.section))
    failures.push("Section busy");
  return failures;
}
export function score(room: Room, needs: Needs): number {
  const fit = Math.min(1, needs.seats / room.capacity);
  return Math.round(
    Math.max(
      0,
      65 * fit +
        (room.block === needs.block ? 30 : 0) +
        5 -
        (room.type === "computer_lab" && !needs.resources.computers ? 15 : 0),
    ),
  );
}
export function rank(state: State, slot: Slot, needs: Needs) {
  return state.rooms
    .map((room) => ({
      room,
      failures: validate(state, room, slot, needs),
      score: score(room, needs),
      why: `${room.capacity - needs.seats} spare seats${room.block === needs.block ? ", same block" : ""}; working facilities checked`,
    }))
    .sort(
      (a, b) =>
        Number(a.failures.length > 0) - Number(b.failures.length > 0) ||
        b.score - a.score ||
        a.room.number.localeCompare(b.room.number),
    );
}
export function baseline(state: State, slot: Slot, needs: Needs) {
  return state.rooms.find((room) => !validate(state, room, slot, needs).length);
}
export function suggestions(
  state: State,
  session: Session,
  cancelledDate: string,
) {
  const results: { room: Room; slot: Slot; score: number; why: string }[] = [];
  const block = state.rooms.find((room) => room.id === session.roomId)?.block;
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const duration = toMinutes(session.end) - toMinutes(session.start);
  if (duration <= 0) return [];
  let searched = 0;
  for (let offset = 1; searched < 14 && offset < 60; offset++) {
    const date = nextDate(cancelledDate, offset);
    if (
      new Date(date + "T12:00:00Z").getUTCDay() === 0 || (state.periods?.length && new Date(date + "T12:00:00Z").getUTCDay() === 6) ||
      state.holidays.includes(date)
    )
      continue;
    searched++;

    const periodCount = session.sessionType === "lab" && session.startPeriod && session.endPeriod ? session.endPeriod - session.startPeriod + 1 : 1;
    const campusSlots = state.periods?.flatMap((period, index) => {
      const last = state.periods?.[index + periodCount - 1];
      if (!last || (periodCount > 1 && period.period <= 4 && last.period > 4) || (periodCount > 1 && period.period <= 8 && last.period > 8)) return [];
      return [{start: period.start, end: last.end}];
    });
    const fallbackSlots = [9, 10, 11, 13, 14, 15, 16].flatMap(hour => {
      const endMinute = hour * 60 + duration;
      if (endMinute > 17 * 60 || (hour < 13 && endMinute > 12 * 60)) return [];
      return [{start: String(hour).padStart(2,"0")+":00",end: String(Math.floor(endMinute / 60)).padStart(2,"0")+":"+String(endMinute % 60).padStart(2,"0")}];
    });
    for (const period of campusSlots?.length ? campusSlots : fallbackSlots) {
      const slot = {date, start: period.start, end: period.end};
      const candidate = rank(state, slot, {
        seats: session.seats,
        resources: state.staffPool?.length ? {} : { projector: 1 },
        facultyId: session.facultyId,
        section: session.section,
        block,
      }).find((option) => !option.failures.length);
      if (candidate)
        results.push({
          room: candidate.room,
          slot,
          score: candidate.score - Math.min(offset, 14),
          why: candidate.why,
        });
    }
  }
  return results
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.slot.date.localeCompare(b.slot.date) ||
        a.slot.start.localeCompare(b.slot.start),
    )
    .slice(0, 3);
}

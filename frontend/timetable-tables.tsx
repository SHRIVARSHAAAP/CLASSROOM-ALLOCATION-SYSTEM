"use client";

import type { Session, State } from "@/lib/types";

export type TimetableRow = Pick<Session,
  "id" | "day" | "start" | "end" | "subject" | "section" | "facultyId" | "faculty" | "roomId"
> & { status?: string; reason?: string };

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TimetableTables({
  rows, state, weekly, groupBy, date,
}: {
  rows: TimetableRow[];
  state: State;
  weekly: boolean;
  groupBy: "section" | "faculty";
  date: string;
}) {
  const groups = new Map<string, { name: string; rows: TimetableRow[] }>();
  for (const row of rows) {
    const key = groupBy === "faculty" ? row.facultyId : row.section;
    const name = groupBy === "faculty" ? row.faculty : row.section;
    const group = groups.get(key) ?? { name: name || "Unassigned", rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  if (!groups.size) return (
    <section className="panel">
      <h2>No classes found</h2>
      <p className="muted">Try another date or clear the search.</p>
    </section>
  );
  return (
    <div className="timetable-tables">
      {Array.from(groups.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([key, group]) => {
        const ordered = [...group.rows].sort((a, b) =>
          a.day - b.day || a.start.localeCompare(b.start) || a.end.localeCompare(b.end)
        );
        const slots = state.periods?.length ? state.periods : Array.from(new Map(ordered.map((row) => [
          row.start + "|" + row.end, { start: row.start, end: row.end },
        ])).values()).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
        const room = (id: string) => state.rooms.find((r) => r.id === id)?.number ?? "Venue not set";
        return (
          <section className="panel" key={key}>
            <h2>{groupBy === "faculty" ? "Faculty: " : "Class: "}{group.name}</h2>
            <div className="table-wrap" role="region" aria-label={group.name + " timetable"} tabIndex={0}>
              <table className="compact-timetable">
                <caption>{group.name} · {weekly ? "Fixed weekly timetable" : date} · IST</caption>
                {weekly ? (
                  <>
                    <thead><tr><th scope="col">Day</th>{slots.map((slot) => (
                      <th scope="col" key={slot.start + "|" + slot.end}>{slot.start}–{slot.end}</th>
                    ))}</tr></thead>
                    <tbody>{days.slice(0, state.periods?.length ? 5 : 6).map((day, i) => (
                      <tr key={day}>
                        <th scope="row">{day}</th>
                        {slots.map((slot) => (
                          <td key={slot.start + "|" + slot.end}>
                            {ordered.filter((row) => row.day === i + 1 && row.start <= slot.start && row.end >= slot.end).map((row) => (
                              <div className="timetable-cell" key={row.id}>
                                <strong>{row.subject}</strong>
                                <span>{groupBy === "faculty" ? row.section : row.faculty}</span>
                                <span>{room(row.roomId)}</span>
                              </div>
                            ))}
                            {!ordered.some((row) => row.day === i + 1 && row.start <= slot.start && row.end >= slot.end) && <span aria-label="No class">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}</tbody>
                  </>
                ) : (
                  <>
                    <thead><tr>
                      <th scope="col">Time</th><th scope="col">Subject</th>
                      <th scope="col">{groupBy === "faculty" ? "Class" : "Faculty"}</th>
                      <th scope="col">Room</th><th scope="col">Status</th>
                    </tr></thead>
                    <tbody>{ordered.map((row) => (
                      <tr key={row.id}>
                        <td>{row.start}–{row.end}</td><td>{row.subject}</td>
                        <td>{groupBy === "faculty" ? row.section : row.faculty}</td>
                        <td>{room(row.roomId)}</td>
                        <td>{(row.status ?? "scheduled").replaceAll("_", " ")}{row.reason && <small>{row.reason}</small>}</td>
                      </tr>
                    ))}</tbody>
                  </>
                )}
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

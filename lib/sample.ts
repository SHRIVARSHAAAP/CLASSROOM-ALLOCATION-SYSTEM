import {
  blockIds,
  nextDate,
  today,
  type Room,
  type Session,
  type State,
} from "./types";
export const SAMPLE_KEY = "psg-fresh-campus-v1";
export function seed(date = today()): State {
  const rooms: Room[] = blockIds.flatMap((block) =>
    Array.from(
      { length: 50 },
      (_, i) =>
        ({
          id: `${block}-${i}`,
          block,
          floor: i % 4,
          number: `${block}-${i % 4}${String(Math.floor(i / 4) + 1).padStart(2, "0")}`,
          capacity: [40, 60, 80, 100, 120, 150, 200][i % 7],
          type:
            i % 10 === 0
              ? "computer_lab"
              : i % 9 === 0
                ? "lab"
                : i % 7 === 0
                  ? "seminar"
                  : "lecture",
          active: true,
          resources: {
            projector: i % 17 === 0 ? 0 : 1,
            computers: i % 10 === 0 ? 40 : 0,
            ac: i % 3 === 0 ? 1 : 0,
            smart_board: i % 7 === 0 ? 1 : 0,
            lab_equipment: i % 9 === 0 ? 20 : 0,
          },
        }) as Room,
    ),
  );
  const subjects = [
    "Data Structures",
    "Computer Networks",
    "Database Systems",
    "Operating Systems",
    "Mathematics",
    "Software Engineering",
  ];
  const times = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
  const sessions: Session[] = Array.from({ length: 72 }, (_, i) => {
    const group = i % 12;
    const pos = group % 6;
    const cse = group < 6;
    const room = rooms.find(
      (r) => r.block === (cse ? "C" : "I") && r.id.endsWith("-" + (group + 1)),
    )!;
    return {
      id: "S" + i,
      day: Math.floor(i / 12) + 1,
      start: times[pos],
      end: `${String(Number(times[pos].slice(0, 2)) + 1).padStart(2, "0")}:00`,
      roomId: room.id,
      subject: subjects[pos],
      department: cse ? "CSE" : "IT",
      year: 2,
      section: cse ? "CSE II A" : "IT II A",
      facultyId: "F" + group,
      faculty: group === 0 ? "Dr. Meena" : "Prof. " + (group + 1),
      seats: 40,
    };
  });
  const extras = rooms
    .filter((_, i) => i % 49 === 0)
    .map((r) => ({
      id: "maintenance-" + r.id,
      roomId: r.id,
      date,
      start: "08:00",
      end: "18:00",
      kind: "maintenance" as const,
      title: "Scheduled facility servicing",
    }));
  const state: State = {
    version: 1,
    rooms,
    sessions,
    extras,
    overrides: [],
    requests: [],
    bookings: [],
    audit: [],
    counter: 0,
    holidays: [],
    notifications: [],
  };
  const session = sessions.find(
    (s) =>
      s.day === new Date(date + "T12:00:00Z").getUTCDay() &&
      s.section === "CSE II A",
  );
  if (session) {
    state.requests.push({
      id: "sample-cancellation",
      type: "cancellation",
      sessionId: session.id,
      date,
      reason: "Faculty attending a university academic meeting",
      status: "pending",
      reporter: "CSE Class Rep",
    });
    state.requests.push({
      id: "sample-issue",
      type: "issue",
      sessionId: session.id,
      date,
      reason:
        "Projector is not switching on; needs inspection before the next class",
      status: "pending",
      reporter: "CSE Class Rep",
    });
    state.requests.push({
      id: "sample-permission",
      type: "permission",
      sessionId: session.id,
      date,
      reason: "Need a room with more working computers for a practical session",
      status: "pending",
      reporter: "CSE Class Rep",
    });
  }
  state.notifications.push({
    id: "welcome",
    roles: ["admin", "rep", "club", "student", "faculty"],
    title: "Welcome to your new campus workspace",
    body: "These are sample records. Changes are saved in this browser and can be reviewed by switching demo roles.",
    time: new Date().toISOString(),
    read: [],
    whatsapp: "skipped_no_consent",
  });
  // A future sample booking demonstrates the full signed-letter workflow.
  state.bookings.push({
    id: "sample-booking",
    reference: "CLUB-" + date.slice(0, 4) + "-0001",
    club: "The Eye",
    organizer: "Varsha",
    department: "CSE",
    coordinator: "Dr. Meena",
    event: "Cyber Lock",
    purpose: "A student cybersecurity awareness event",
    date: nextDate(date, 1),
    start: "16:00",
    end: "17:00",
    participants: 40,
    roomId: "D-1",
    resources: { projector: 1 },
    status: "awaiting_hod_signature",
  });
  state.counter = 1;
  return state;
}

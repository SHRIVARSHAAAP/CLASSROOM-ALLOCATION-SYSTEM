import type { Role } from "./types";
export const pageLabels: Record<string, string> = {
  dashboard: "Dashboard",
  accounts: "Accounts",
  classrooms: "Classrooms",
  timetable: "Class Timetables",
  "faculty-timetable": "Faculty Timetables",
  cancellations: "Cancellations",
  issues: "Issues",
  rescheduling: "Rescheduling",
  permissions: "Rep Permissions",
  bookings: "Club Bookings",
  map: "Campus Map",
  reports: "Reports",
  notifications: "Notifications",
  audit: "Audit Log",
  rooms: "Classroom Finder",
  "report-cancellation": "Report Cancellation",
  "report-issue": "Report Issue",
  "request-permission": "Request Permission",
  "change-room": "Change Classroom",
  "my-requests": "My Requests",
  "booking-request": "Booking Request",
  "hod-letter": "Generate HOD Letter",
  "signed-letter": "Upload Signed Letter",
  "my-bookings": "My Bookings",
};
export const navigation: Record<Role, string[]> = {
  admin: [
    "dashboard",
    "classrooms",
    "accounts",
    "timetable",
    "faculty-timetable",
    "cancellations",
    "issues",
    "rescheduling",
    "permissions",
    "bookings",
    "map",
    "reports",
    "notifications",
    "audit",
  ],
  rep: [
    "dashboard",
    "timetable",
    "report-cancellation",
    "report-issue",
    "request-permission",
    "change-room",
    "my-requests",
    "map",
    "notifications",
  ],
  club: [
    "dashboard",
    "rooms",
    "booking-request",
    "hod-letter",
    "signed-letter",
    "my-bookings",
    "map",
    "notifications",
  ],
  faculty: ["map", "timetable"],
  student: ["dashboard", "timetable", "map", "notifications"],
};
export function title(view: string, role: Role): string {
  return view === "timetable" && role !== "admin"
    ? role === "faculty"
      ? "My Schedule"
      : "My Timetable"
    : view === "rooms" && role === "faculty"
      ? "Classroom Details"
      : (pageLabels[view] ?? "Dashboard");
}

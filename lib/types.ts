import { z } from "zod";

export const roleSchema = z.enum([
  "admin",
  "rep",
  "club",
  "faculty",
  "student",
]);
export type Role = z.infer<typeof roleSchema>;
export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  rep: "Class Rep",
  club: "Club Member",
  faculty: "Faculty",
  student: "Student",
};
export type User = {
  id: string;
  name: string;
  role: Role;
  section?: string;
  facultyId?: string;
  isActive: boolean;
  clubPermission?: boolean;
};
export type Room = {
  id: string;
  block: string;
  floor: number;
  number: string;
  capacity: number;
  type: "lecture" | "computer_lab" | "lab" | "seminar";
  active: boolean;
  resources: Record<string, number>;
};
export type Slot = { date: string; start: string; end: string };
export type Session = {
  id: string;
  day: number;
  start: string;
  end: string;
  roomId: string;
  subject: string;
  department: string;
  year: number;
  section: string;
  facultyId: string;
  faculty: string;
  seats: number;
  validFrom?: string;
  validTo?: string;
};
export type Override = {
  sessionId: string;
  date: string;
  cancelled?: boolean;
  roomId?: string;
  reason: string;
  reporter: string;
  approver: string;
};
export type Extra = Slot & {
  id: string;
  roomId: string;
  kind: "regular" | "makeup" | "club" | "maintenance";
  section?: string;
  facultyId?: string;
  title: string;
};
export type Request = {
  id: string;
  type: "cancellation" | "issue" | "permission";
  sessionId: string;
  date: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "resolved" | "revoked" | "used";
  reporter: string;
  note?: string;
  expires?: string;
  makeup?: boolean;
};
export type Booking = Slot & {
  id: string;
  reference: string;
  club: string;
  organizer: string;
  department: string;
  coordinator: string;
  event: string;
  purpose: string;
  participants: number;
  resources: Record<string, number>;
  roomId: string;
  status:
    | "draft"
    | "awaiting_hod_signature"
    | "signed_letter_submitted"
    | "approved"
    | "rejected"
    | "cancelled";
  file?: { name: string; data: string };
  note?: string;
};
export type Notification = {
  id: string;
  roles: Role[];
  title: string;
  body: string;
  time: string;
  read: Role[];
  whatsapp: "mock" | "skipped_no_consent";
};
export type Audit = {
  id: string;
  role: Role;
  action: string;
  time: string;
  before: unknown;
  after: unknown;
};
export type State = {
  version: 1;
  rooms: Room[];
  sessions: Session[];
  overrides: Override[];
  extras: Extra[];
  requests: Request[];
  bookings: Booking[];
  notifications: Notification[];
  audit: Audit[];
  counter: number;
  holidays: string[];
  mapImage?: string;
  catalog?: { blockCount: number; sectionCount: number };
  faculty?: { id: string; name: string }[];
  sections?: { id: string; department: string; year: number; size: number }[];
};
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => {
    const parsed = new Date(date + "T12:00:00Z");
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === date
    );
  }, "Choose a valid calendar date");
export const slotSchema = z
  .object({ date: dateSchema, start: timeSchema, end: timeSchema })
  .refine((slot) => slot.start < slot.end, "End time must be after start time");
export const blockIds = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "I",
  "J",
  "K",
  "M",
  "T",
  "Y",
];
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function nextDate(date: string, offset: number): string {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

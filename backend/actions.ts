import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  bookingAction,
  book,
  decide,
  editRoom,
  makeup,
  maintenance,
  move,
  publish,
  report,
} from "@/lib/workflows";
import { roleSchema, slotSchema, type Room, type State } from "@/lib/types";
import { AppError, demoMode, requireRole, sameOrigin } from "./auth";
import { failure } from "./http";

// This endpoint evaluates sample records and returns the result to browser storage.
// It is explicitly unavailable in live mode and does not make real reservations.
const stateSchema = z.object({
  version: z.literal(1),
  rooms: z.array(
    z.object({
      id: z.string(),
      block: z.string(),
      floor: z.number(),
      number: z.string(),
      capacity: z.number(),
      type: z.enum(["lecture", "computer_lab", "lab", "seminar"]),
      active: z.boolean(),
      resources: z.record(z.number()),
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.string(),
      day: z.number(),
      start: z.string(),
      end: z.string(),
      roomId: z.string(),
      subject: z.string(),
      department: z.string(),
      year: z.number(),
      section: z.string(),
      facultyId: z.string(),
      faculty: z.string(),
      seats: z.number(),
    }),
  ),
  overrides: z.array(
    z.object({
      sessionId: z.string(),
      date: z.string(),
      cancelled: z.boolean().optional(),
      roomId: z.string().optional(),
      reason: z.string(),
      reporter: z.string(),
      approver: z.string(),
    }),
  ),
  extras: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      start: z.string(),
      end: z.string(),
      roomId: z.string(),
      kind: z.enum(["regular", "makeup", "club", "maintenance"]),
      section: z.string().optional(),
      facultyId: z.string().optional(),
      title: z.string(),
    }),
  ),
  requests: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["cancellation", "issue", "permission"]),
      sessionId: z.string(),
      date: z.string(),
      reason: z.string(),
      status: z.enum([
        "pending",
        "approved",
        "rejected",
        "resolved",
        "revoked",
        "used",
      ]),
      reporter: z.string(),
      note: z.string().optional(),
      expires: z.string().optional(),
      makeup: z.boolean().optional(),
    }),
  ),
  bookings: z.array(
    z.object({
      id: z.string(),
      reference: z.string(),
      club: z.string(),
      organizer: z.string(),
      department: z.string(),
      coordinator: z.string(),
      event: z.string(),
      purpose: z.string(),
      participants: z.number(),
      resources: z.record(z.number()),
      roomId: z.string(),
      date: z.string(),
      start: z.string(),
      end: z.string(),
      status: z.enum([
        "draft",
        "awaiting_hod_signature",
        "signed_letter_submitted",
        "approved",
        "rejected",
        "cancelled",
      ]),
      file: z.object({ name: z.string(), data: z.string() }).optional(),
      note: z.string().optional(),
    }),
  ),
  notifications: z.array(
    z.object({
      id: z.string(),
      roles: z.array(roleSchema),
      title: z.string(),
      body: z.string(),
      time: z.string(),
      read: z.array(roleSchema),
      whatsapp: z.enum(["mock", "skipped_no_consent"]),
    }),
  ),
  audit: z.array(
    z.object({
      id: z.string(),
      role: roleSchema,
      action: z.string(),
      time: z.string(),
      before: z.unknown(),
      after: z.unknown(),
    }),
  ),
  counter: z.number().int(),
  holidays: z.array(z.string()),
  mapImage: z.string().optional(),
});
const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("report"),
    kind: z.enum(["cancellation", "issue", "permission"]),
    sessionId: z.string(),
    date: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("decide"),
    id: z.string(),
    status: z.enum(["approved", "rejected", "resolved", "revoked"]),
    note: z.string(),
    makeup: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("move"),
    permissionId: z.string(),
    roomId: z.string(),
  }),
  z.object({
    type: z.literal("makeup"),
    requestId: z.string(),
    roomId: z.string(),
    slot: slotSchema,
  }),
  z.object({ type: z.literal("book"), data: z.unknown() }),
  z.object({
    type: z.literal("booking"),
    id: z.string(),
    action: z.enum(["upload", "approve", "reject", "cancel"]),
    note: z.string().optional(),
    file: z
      .object({
        name: z.string(),
        data: z.string(),
        size: z.number(),
        type: z.string(),
      })
      .optional(),
  }),
  z.object({ type: z.literal("room"), room: z.unknown() }),
  z.object({
    type: z.literal("maintenance"),
    roomId: z.string(),
    slot: slotSchema,
    reason: z.string(),
  }),
  z.object({ type: z.literal("publish"), rows: z.unknown() }),
]);
export type DemoAction = z.infer<typeof actionSchema>;
export async function act(request: Request) {
  try {
    sameOrigin(request);
    if (!demoMode())
      throw new AppError(403, "Sample actions are disabled in live mode.");
    const user = await requireRole([
      "admin",
      "rep",
      "club",
      "faculty",
      "student",
    ]);
    const body = await request.json();
    const state = stateSchema.parse(body.state) as State;
    const action = actionSchema.parse(body.action);
    let result: State;
    switch (action.type) {
      case "report":
        result = report(state, user.role, {
          type: action.kind,
          sessionId: action.sessionId,
          date: action.date,
          reason: action.reason,
        });
        break;
      case "decide":
        result = decide(
          state,
          user.role,
          action.id,
          action.status,
          action.note,
          action.makeup,
        );
        break;
      case "move":
        result = move(state, user.role, action.permissionId, action.roomId);
        break;
      case "makeup":
        result = makeup(
          state,
          user.role,
          action.requestId,
          action.roomId,
          action.slot,
        );
        break;
      case "book": {
        const { bookingInput } = await import("@/lib/workflows");
        result = book(state, user.role, bookingInput.parse(action.data));
        break;
      }
      case "booking":
        result = bookingAction(
          state,
          user.role,
          action.id,
          action.action,
          action.note,
          action.file,
        );
        break;
      case "maintenance":
        result = maintenance(
          state,
          user.role,
          action.roomId,
          action.slot,
          action.reason,
        );
        break;
      case "publish":
        result = publish(state, user.role, action.rows);
        break;
      case "room":
        result = editRoom(state, user.role, action.room as Room);
        break;
    }
    return NextResponse.json({ state: result });
  } catch (error) {
    return failure(error);
  }
}

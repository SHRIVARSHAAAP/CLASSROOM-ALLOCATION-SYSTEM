import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./auth";
export function failure(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Check your input." },
      { status: 400 },
    );
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete the request.",
    },
    { status: 400 },
  );
}

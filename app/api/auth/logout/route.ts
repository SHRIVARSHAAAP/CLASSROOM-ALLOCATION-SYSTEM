import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole, sameOrigin } from "@/backend/auth";
import { failure } from "@/backend/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireRole(["admin", "rep", "club", "faculty", "student"]);
    const jar = await cookies();
    for (const name of ["campus_demo", "campus_access", "campus_refresh"])
      jar.delete(name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { NextResponse } from "next/server";
import { roleSchema } from "@/lib/types";
import {
  AppError,
  demoMode,
  sameOrigin,
  sampleUser,
  secureCookie,
  signDemo,
  supabase,
} from "./auth";
import { failure } from "./http";
const inputSchema = z
  .object({
    role: roleSchema,
    identifier: z.string().trim().min(3).max(128),
    password: z.string().min(1).max(256),
    demo: z.boolean(),
  })
  .strict();
export async function login(request: Request) {
  try {
    sameOrigin(request);
    const input = inputSchema.parse(await request.json());
    const jar = await cookies();
    if (input.demo) {
      if (!demoMode()) throw new AppError(403, "Sample logins are disabled.");
      const user = sampleUser(input.role);
      jar.set("campus_demo", signDemo(user), {
        ...secureCookie,
        maxAge: 8 * 3600,
      });
      return NextResponse.json({ user });
    }
    if (demoMode())
      throw new AppError(
        400,
        "Use the demo portal button for sample accounts.",
      );
    const db = supabase(true);
    const key =
      input.identifier.toLowerCase() +
      "|" +
      (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local");
    const attempt = await db.rpc("allow_login_attempt", { attempt_key: key });
    if (attempt.error)
      throw new AppError(503, "Login protection is temporarily unavailable.");
    if (!attempt.data)
      throw new AppError(429, "Account locked. Try again after 15 minutes.");
    let email = input.identifier.toLowerCase();
    if (input.role === "student" && !input.identifier.includes("@")) {
      const profile = await db
        .from("users")
        .select("email")
        .eq("roll_number", input.identifier.toUpperCase())
        .maybeSingle();
      email = profile.data?.email ?? "";
    }
    const incorrect = "Incorrect roll number/email or password";
    if (!email) throw new AppError(401, incorrect);
    const client = supabase();
    const auth = await client.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (auth.error || !auth.data.session) throw new AppError(401, incorrect);
    const profile = await db
      .from("users")
      .select("id,role,is_active")
      .eq("id", auth.data.user.id)
      .maybeSingle();
    if (!profile.data?.is_active || profile.data.role !== input.role) {
      await client.auth.signOut();
      throw new AppError(401, incorrect);
    }
    await db.rpc("reset_login_attempts", { attempt_key: key });
    jar.set("campus_access", auth.data.session.access_token, {
      ...secureCookie,
      maxAge: auth.data.session.expires_in,
    });
    jar.set("campus_refresh", auth.data.session.refresh_token, {
      ...secureCookie,
      maxAge: 30 * 86400,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

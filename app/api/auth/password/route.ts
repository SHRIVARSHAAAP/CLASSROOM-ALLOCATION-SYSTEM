import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, demoMode, sameOrigin, supabase } from "@/backend/auth";
import { failure } from "@/backend/http";
const schema = z
  .object({
    access: z.string().min(20).max(10000),
    refresh: z.string().min(5).max(10000),
    password: z.string().min(8).max(256),
  })
  .strict();
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (demoMode())
      throw new AppError(400, "Sample accounts have no recovery password.");
    const input = schema.parse(await request.json());
    const client = supabase();
    const session = await client.auth.setSession({
      access_token: input.access,
      refresh_token: input.refresh,
    });
    if (session.error || !session.data.user)
      throw new AppError(401, "Recovery link is invalid or expired.");
    const result = await client.auth.updateUser({ password: input.password });
    if (result.error)
      throw new AppError(
        400,
        "Unable to update password. Request a new recovery link.",
      );
    await client.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

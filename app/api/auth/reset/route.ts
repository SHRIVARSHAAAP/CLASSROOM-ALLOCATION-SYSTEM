import { NextResponse } from "next/server";
import { z } from "zod";
import { demoMode, sameOrigin, supabase } from "@/backend/auth";
import { failure } from "@/backend/http";
const schema = z
  .object({
    identifier: z.string().trim().min(3).max(128),
    student: z.boolean(),
  })
  .strict();
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = schema.parse(await request.json());
    if (!demoMode()) {
      let email = input.identifier;
      if (input.student) {
        const result = await supabase(true)
          .from("users")
          .select("email")
          .eq("roll_number", input.identifier.toUpperCase())
          .maybeSingle();
        email = result.data?.email ?? "";
      }
      if (email)
        await supabase().auth.resetPasswordForEmail(email, {
          redirectTo: new URL("/reset-password", request.url).toString(),
        });
    }
    return NextResponse.json({
      message: demoMode()
        ? "Sample accounts have no reset email. Use the demo button."
        : "If the account exists, a reset email will be sent.",
    });
  } catch (error) {
    return failure(error);
  }
}

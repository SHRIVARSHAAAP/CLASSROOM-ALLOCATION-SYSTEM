import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { roleSchema, roleLabels, type Role, type User } from "@/lib/types";

export const demoMode = () => process.env.NEXT_PUBLIC_DEMO === "true";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const secureCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: roleSchema,
  section: z.string().optional(),
  facultyId: z.string().optional(),
  isActive: z.boolean(),
});
function demoSecret() {
  const secret = process.env.DEMO_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(503, "Demo session configuration is missing.");
  return secret;
}
export function signDemo(user: User): string {
  const payload = Buffer.from(
    JSON.stringify({ user, expires: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", demoSecret()).update(payload).digest("base64url")
  );
}
export function verifyDemo(value: string): User | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", demoSecret()).update(parts[0]).digest();
  const signature = Buffer.from(parts[1], "base64url");
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  )
    return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const user = userSchema.parse(parsed.user);
    return Number(parsed.expires) > Date.now() && user.isActive ? user : null;
  } catch {
    return null;
  }
}
export function sampleUser(role: Role): User {
  return {
    id: "sample-" + role,
    name:
      role === "admin"
        ? "Campus Admin"
        : role === "faculty"
          ? "Dr. Meena"
          : role === "rep"
            ? "CSE Class Rep"
            : role === "club"
              ? "Varsha"
              : "Varsha",
    role,
    section: "CSE II A",
    facultyId: role === "faculty" ? "F0" : undefined,
    isActive: true,
  };
}
export function supabase(server = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = server
    ? (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
    : (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY);
  if (!url || !key)
    throw new AppError(503, "Live Supabase authentication is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  if (demoMode())
    return jar.has("campus_demo")
      ? verifyDemo(jar.get("campus_demo")!.value)
      : null;
  const access = jar.get("campus_access")?.value;
  if (!access) return null;
  const auth = await supabase().auth.getUser(access);
  if (auth.error || !auth.data.user) return null;
  const { data } = await supabase(true)
    .from("users")
    .select("id,name,role,section_id,is_active,club_permission")
    .eq("id", auth.data.user.id)
    .maybeSingle();
  if (!data?.is_active) return null;
  return {
    id: data.id,
    name: data.name,
    role: roleSchema.parse(data.role),
    section: data.section_id ?? undefined,
    facultyId: data.role === "faculty" ? data.id : undefined,
    clubPermission: data.club_permission,
    isActive: true,
  };
}
export async function requireRole(allowed: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) throw new AppError(401, "Sign in to continue.");
  if (!allowed.includes(user.role))
    throw new AppError(
      403,
      `${roleLabels[user.role]} cannot perform this action.`,
    );
  return user;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host"))
    throw new AppError(403, "Invalid request origin.");
}

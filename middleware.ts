import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO === "true") {
    if (!request.cookies.has("campus_demo"))
      return NextResponse.redirect(new URL("/login/student", request.url));
    return NextResponse.next();
  }
  const access = request.cookies.get("campus_access")?.value;
  const refresh = request.cookies.get("campus_refresh")?.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let expires = 0;
  try {
    expires = JSON.parse(
      atob(
        (access?.split(".")[1] ?? "").replaceAll("-", "+").replaceAll("_", "/"),
      ),
    ).exp;
  } catch {
    /* Invalid access is verified again in the server handler. */
  }
  if (refresh && url && key && expires * 1000 < Date.now() + 60000) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await client.auth.refreshSession({ refresh_token: refresh });
    if (result.data.session) {
      const session = result.data.session;
      request.cookies.set("campus_access", session.access_token);
      const response = NextResponse.next({
        request: { headers: request.headers },
      });
      const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
      };
      response.cookies.set("campus_access", session.access_token, {
        ...options,
        maxAge: session.expires_in,
      });
      response.cookies.set("campus_refresh", session.refresh_token, {
        ...options,
        maxAge: 30 * 86400,
      });
      return response;
    }
  }
  return access
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/login/student", request.url));
}
export const config = { matcher: ["/portal/:path*"] };

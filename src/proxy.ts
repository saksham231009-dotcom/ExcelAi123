import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED = ["/dashboard", "/workspace"];
const GUEST_ONLY = ["/sign-in", "/sign-up", "/forgot-password"];
const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const { response, user, configured } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (matches(pathname, PROTECTED) && !user) {
    const hadSession = request.cookies
      .getAll()
      .some((c) => c.name.includes("auth-token"));
    const params = new URLSearchParams({ next: pathname + search });
    if (!configured) params.set("error", "config");
    else if (hadSession) params.set("error", "session_expired");
    return redirect(`/sign-in?${params}`);
  }
  if (matches(pathname, GUEST_ONLY) && user) return redirect("/dashboard");
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workspace/:path*",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
  ],
};

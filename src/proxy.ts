import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { GATE_COOKIE, gateToken, safeNext } from "./lib/site-gate";
import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const open = pathname === "/ulaz" || pathname.startsWith("/api/ulaz");
  if (!open && request.cookies.get(GATE_COOKIE)?.value !== (await gateToken())) {
    const url = request.nextUrl.clone();
    url.pathname = "/ulaz";
    url.search = "";
    url.searchParams.set("next", safeNext(pathname + request.nextUrl.search));
    return NextResponse.redirect(url);
  }
  if (open) return NextResponse.next();
  if (pathname.startsWith("/admin")) {
    if (!pathname.startsWith("/admin/prijava") && !getSessionCookie(request)) {
      return NextResponse.redirect(new URL("/admin/prijava", request.url));
    }
    return NextResponse.next();
  }
  if (pathname.startsWith("/api") || pathname.startsWith("/reset-lozinke")) return NextResponse.next();
  return handleI18n(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media|favicon.ico|.*\\..*).*)"],
};

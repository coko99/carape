import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

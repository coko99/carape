import { NextResponse } from "next/server";
import { GATE_COOKIE, SITE_PASSWORD, gateToken, safeNext } from "@/lib/site-gate";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));
  if (password !== SITE_PASSWORD) {
    const back = new URL("/ulaz", request.url);
    back.searchParams.set("error", "1");
    back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(GATE_COOKIE, await gateToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}

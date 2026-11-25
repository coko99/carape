"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Link, useRouter } from "@/i18n/navigation";

export function AuthForm({ mode, locale }: { mode: "login" | "register"; locale: "sr" | "en" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const sr = locale === "sr";
  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const email = String(form.get("email"));
        const password = String(form.get("password"));
        const name = String(form.get("name") || email);
        const result = mode === "login"
          ? await authClient.signIn.email({ email, password, callbackURL: locale === "en" ? "/en/account" : "/nalog" })
          : await authClient.signUp.email({ email, password, name, callbackURL: locale === "en" ? "/en/account" : "/nalog" });
        if (result.error) setError(result.error.message || (sr ? "Prijava nije uspela." : "Sign-in failed."));
        else router.push("/nalog");
      }}
    >
      <h1 className="text-5xl">{mode === "login" ? (sr ? "Prijava" : "Sign in") : (sr ? "Novi nalog" : "Create account")}</h1>
      {mode === "register" ? <label className="field"><span>{sr ? "Ime" : "Name"}</span><input name="name" required /></label> : null}
      <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
      <label className="field"><span>{sr ? "Lozinka" : "Password"}</span><input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
      {error ? <p role="alert" className="text-clay">{error}</p> : null}
      <button className="btn w-fit" type="submit">{mode === "login" ? (sr ? "Prijavi se" : "Sign in") : (sr ? "Otvori nalog" : "Create account")}</button>
      <Link href={mode === "login" ? "/registracija" : "/prijava"}>{mode === "login" ? (sr ? "Nemate nalog?" : "Need an account?") : (sr ? "Već imate nalog?" : "Already registered?")}</Link>
      <Link href="/zaboravljena-lozinka">{sr ? "Zaboravljena lozinka" : "Forgot password"}</Link>
    </form>
  );
}

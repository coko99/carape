"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { BrandMark } from "@/components/brand-mark";

export default function Page() {
  const [error, setError] = useState("");
  return (
    <form
      className="mx-auto grid min-h-screen max-w-md content-center gap-3 px-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await authClient.signIn.email({
          email: String(form.get("email")),
          password: String(form.get("password")),
          callbackURL: "/admin",
        });
        if (result.error) setError(result.error.message || "Prijava nije uspela.");
        else window.location.href = "/admin";
      }}
    >
      <BrandMark className="h-24 w-auto" />
      <h1 className="text-2xl">Administracija</h1>
      <label className="field"><span>Email</span><input name="email" type="email" required /></label>
      <label className="field"><span>Lozinka</span><input name="password" type="password" required /></label>
      {error ? <p role="alert">{error}</p> : null}
      <button className="btn" type="submit">Prijava</button>
    </form>
  );
}

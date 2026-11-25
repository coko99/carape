"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function Page() {
  const [message, setMessage] = useState("");
  return (
    <form
      className="wrap grid max-w-md gap-3 py-12"
      onSubmit={async (event) => {
        event.preventDefault();
        const email = String(new FormData(event.currentTarget).get("email"));
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-lozinke",
        });
        setMessage(result.error ? result.error.message || "Error" : "Ako nalog postoji, link je sačuvan za slanje. Bez RESEND_API_KEY poruka ostaje u evidenciji, nije poslata.");
      }}
    >
      <h1 className="text-5xl">Lozinka</h1>
      <label className="field"><span>Email</span><input name="email" type="email" required /></label>
      <button className="btn w-fit" type="submit">Pošalji link</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

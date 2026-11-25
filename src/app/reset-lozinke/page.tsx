"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState("");
  return (
    <form
      className="mx-auto grid min-h-screen max-w-md content-center gap-3 px-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const token = new URLSearchParams(window.location.search).get("token");
        if (!token) {
          setMessage("Link nema token. Zatražite novi sa stranice za zaboravljenu lozinku.");
          return;
        }
        const password = String(new FormData(event.currentTarget).get("password"));
        const result = await authClient.resetPassword({ newPassword: password, token });
        setMessage(result.error ? result.error.message || "Lozinka nije sačuvana." : "Lozinka je sačuvana.");
      }}
    >
      <h1 className="text-4xl">Nova lozinka</h1>
      <label className="field">
        <span>Nova lozinka</span>
        <input name="password" type="password" minLength={8} required autoComplete="new-password" />
      </label>
      <button className="btn w-fit" type="submit">Sačuvaj</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

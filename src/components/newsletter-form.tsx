"use client";

import { useState } from "react";
import { subscribeNewsletter } from "@/server/actions";

export function NewsletterForm({
  locale,
  title,
  text,
  consent,
  send,
  sent,
}: {
  locale: "sr" | "en";
  title: string;
  text: string;
  consent: string;
  send: string;
  sent: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <form
      className="mt-6 grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await subscribeNewsletter({
          email: String(form.get("email") || ""),
          consent: form.get("consent") === "on",
          locale,
        });
        setDone(result.ok);
      }}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted">{text}</p>
      <input name="email" type="email" required autoComplete="email" className="border border-line bg-white px-3 py-2" />
      <label className="flex items-start gap-2 text-sm">
        <input name="consent" type="checkbox" required className="mt-1" />
        <span>{consent}</span>
      </label>
      <button className="btn w-fit" type="submit">{send}</button>
      {done ? <p role="status">{sent}</p> : null}
    </form>
  );
}

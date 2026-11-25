"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { company } from "@/content/copy";

function digits(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export function ChatDock({ locale }: { locale: "sr" | "en" }) {
  const [open, setOpen] = useState(false);
  const person = company.people[0];
  const number = person ? digits(person.phone) : "";
  const sr = locale === "sr";
  return (
    <div className="chat-dock">
      {open ? (
        <div className="chat-panel" role="dialog" aria-label={sr ? "Poruka" : "Message"}>
          <p>{sr ? "Pišite nam direktno. Odgovor stiže na telefon radionice." : "Message the workshop directly."}</p>
          {person ? <p className="chat-person">{person.name}</p> : null}
          <a className="chat-link" href={`https://wa.me/${number}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="chat-link" href={`viber://chat?number=%2B${number}`}>Viber</a>
          <Link className="chat-link quiet" href="/pitanja">{sr ? "Najčešća pitanja" : "FAQ"}</Link>
        </div>
      ) : null}
      <button type="button" className="chat-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? (sr ? "Zatvori" : "Close") : (sr ? "Chat" : "Chat")}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { askAssistantAction } from "@/server/assistant-actions";
import { formatRsd } from "@/lib/commerce";

export function ShopAssistant() {
  const [open, setOpen] = useState(false);
  const [token] = useState(() => crypto.randomUUID());
  const [question, setQuestion] = useState("");
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [log, setLog] = useState<{ role: string; body: string; cards?: { name: string; slug: string; priceMinor: number; availability: string }[] }[]>([]);
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    setBusy(true);
    const result = await askAssistantAction({ token, question: text, email, orderNumber });
    setBusy(false);
    if (!result.ok) {
      setLog((items) => [...items, { role: "assistant", body: "Previše poruka u poslednjih sat vremena." }]);
      return;
    }
    setLog((items) => [...items, { role: "user", body: text }, { role: "assistant", body: result.ai ? result.text : `${result.text} Katalog je izvor cijene.`, cards: result.cards }]);
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)]">
      {open ? (
        <div className="mb-2 w-80 border border-line bg-paper p-3 shadow-sm">
          <p className="text-sm">Pitajte o katalogu, dostavi ili statusu porudžbine. Za status unesite i imejl.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {["Imate li muške termo čarape?", "Koliko košta dostava?"].map((prompt) => (
              <button key={prompt} type="button" className="underline" onClick={() => send(prompt)}>{prompt}</button>
            ))}
          </div>
          <div className="mt-3 grid max-h-64 gap-2 overflow-auto text-sm">
            {log.map((item, index) => (
              <div key={index}>
                <p>{item.body}</p>
                {item.cards?.map((card) => (
                  <a key={card.slug} className="mt-1 block border border-line p-2" href={`/proizvod/${card.slug}`}>
                    {card.name}<br />{formatRsd(card.priceMinor)} · {card.availability}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <label className="field mt-2"><span>Imejl za status</span><input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field"><span>Broj porudžbine</span><input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} /></label>
          <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (question.trim()) { void send(question); setQuestion(""); } }}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Pitanje" className="min-w-0 flex-1" />
            <button className="btn" type="submit" disabled={busy}>Pošalji</button>
          </form>
        </div>
      ) : null}
      <button type="button" className="btn ml-auto" onClick={() => setOpen((value) => !value)}>{open ? "Zatvori" : "Asistent"}</button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export function CookieBanner({ locale }: { locale: "sr" | "en" }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(!localStorage.getItem("zajo-consent"));
  }, []);
  if (!visible) return null;
  const text = locale === "sr"
    ? "Neophodni kolačići pamte korpu i prijavu. Analitika nije uključena."
    : "Necessary cookies remember the bag and sign-in. Analytics is off.";
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 border border-line bg-paper-2 p-4 shadow-sm md:inset-x-auto md:right-4 md:max-w-sm">
      <p className="text-sm">{text}</p>
      <button
        className="btn mt-3"
        type="button"
        onClick={() => {
          localStorage.setItem("zajo-consent", JSON.stringify({ necessary: true, analytics: false, at: new Date().toISOString() }));
          setVisible(false);
        }}
      >
        {locale === "sr" ? "Prihvatam neophodne" : "Accept necessary"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function SitePreloader() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"on" | "out" | "off">(pathname === "/ulaz" ? "off" : "on");

  useEffect(() => {
    if (pathname === "/ulaz") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = window.setTimeout(() => setPhase("out"), reduced ? 180 : 1400);
    const done = window.setTimeout(() => setPhase("off"), reduced ? 360 : 1900);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(done);
    };
  }, [pathname]);

  if (phase === "off") return null;

  return (
    <div className={`preloader ${phase === "out" ? "is-out" : ""}`} role="status" aria-live="polite">
      <p className="kicker">Kruševac · 1992</p>
      <strong>ŽA—JO</strong>
      <span className="preloader-line" />
      <em>proizvodnja čarapa</em>
    </div>
  );
}

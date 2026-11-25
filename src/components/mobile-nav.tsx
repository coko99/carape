"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";

export function MobileNav({
  labels,
}: {
  labels: { shop: string; about: string; custom: string; contact: string; menu: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button type="button" className="nav-link bg-transparent" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {labels.menu}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full border-b border-line bg-paper-2 px-4 py-5 shadow-lg">
          <div className="grid gap-3">
            <Link href="/" onClick={() => setOpen(false)}>Početna</Link>
            <Link href="/proizvodi" onClick={() => setOpen(false)}>{labels.shop}</Link>
            <Link href="/#kolekcije" onClick={() => setOpen(false)}>Kolekcije</Link>
            <Link href="/pitanja" onClick={() => setOpen(false)}>Pitanja</Link>
            <Link href="/o-nama" onClick={() => setOpen(false)}>{labels.about}</Link>
            <Link href="/paketi" onClick={() => setOpen(false)}>Paketi</Link>
            <Link href="/veleprodaja" onClick={() => setOpen(false)}>Veleprodaja</Link>
            <Link href="/dizajniraj" onClick={() => setOpen(false)}>Dizajn</Link>
            <Link href="/po-meri" onClick={() => setOpen(false)}>{labels.custom}</Link>
            <Link href="/kontakt" onClick={() => setOpen(false)}>{labels.contact}</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

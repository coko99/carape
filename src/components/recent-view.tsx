"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

export function RecentView({ slug, label }: { slug: string; label: string }) {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    const key = "zajo-recent";
    const current = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    const next = [slug, ...current.filter((item) => item !== slug)].slice(0, 8);
    localStorage.setItem(key, JSON.stringify(next));
    setItems(next.filter((item) => item !== slug));
  }, [slug]);
  if (!items.length) return null;
  return (
    <div className="mt-10">
      <h2 className="text-2xl">{label}</h2>
      <ul className="mt-3 flex flex-wrap gap-3 text-sm">
        {items.map((item) => (
          <li key={item}>
            <Link className="page-pill px-3" href={{ pathname: "/proizvod/[slug]", params: { slug: item } }}>{item.replaceAll("-", " ")}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

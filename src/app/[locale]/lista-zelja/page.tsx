"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    setSlugs(JSON.parse(localStorage.getItem("zajo-wish") || "[]"));
  }, []);
  return (
    <div className="wrap py-12">
      <h1 className="text-5xl">Lista</h1>
      <ul className="mt-6 grid gap-2">
        {slugs.map((slug) => (
          <li key={slug}><a href={`/proizvod/${slug}`}>{slug}</a></li>
        ))}
      </ul>
      {slugs.length === 0 ? <p className="mt-4">Prazno.</p> : null}
    </div>
  );
}

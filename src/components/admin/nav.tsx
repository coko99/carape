"use client";

import { usePathname } from "next/navigation";

const groups = [
  {
    title: "Katalog",
    links: [
      ["/admin/proizvodi", "Proizvodi"],
      ["/admin/kategorije", "Kategorije"],
    ],
  },
  {
    title: "Prodaja",
    links: [
      ["/admin/porudzbine", "Porudžbine"],
      ["/admin/lager", "Lager"],
      ["/admin/paketi", "Paketi"],
      ["/admin/veleprodaja", "Veleprodaja"],
      ["/admin/ponude", "Ponude"],
    ],
  },
  {
    title: "Ostalo",
    links: [
      ["/admin/filteri", "Filteri"],
      ["/admin/personalizacija", "Personalizacija"],
      ["/admin/lojalnost", "Lojalnost"],
      ["/admin/finansije", "Finansije"],
      ["/admin/asistent", "Asistent"],
      ["/admin/podesavanja", "Podešavanja"],
      ["/admin/uvoz", "Uvoz"],
      ["/", "Prodavnica"],
    ],
  },
] as const;

function current(pathname: string, href: string) {
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      <a href="/admin" aria-current={current(pathname, "/admin") ? "page" : undefined}>
        Pregled
      </a>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="admin-group">{group.title}</p>
          {group.links.map(([href, label]) => (
            <a key={href} href={href} aria-current={current(pathname, href) ? "page" : undefined}>
              {label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

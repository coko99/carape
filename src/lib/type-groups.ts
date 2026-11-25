import { canonicalTypeKey, typeKey } from "./search";

type TypeItem = {
  key: string;
  sr: string;
  en: string;
  rename?: boolean;
};

type TypeFamily = {
  id: string;
  sr: string;
  en: string;
  items: TypeItem[];
};

export const TYPE_FAMILIES: TypeFamily[] = [
  {
    id: "nazuvice",
    sr: "Nazuvice",
    en: "Liners",
    items: [{ key: "nazuvice", sr: "Nazuvice", en: "Liners" }],
  },
  {
    id: "sokne",
    sr: "Sokne",
    en: "Ankle socks",
    items: [{ key: "sokne", sr: "Sokne", en: "Ankle socks" }],
  },
  {
    id: "carape",
    sr: "Čarape",
    en: "Socks",
    items: [
      { key: "klasicna-carapa", sr: "Klasična", en: "Classic" },
      { key: "klasicna-sportska", sr: "Sportska", en: "Sport" },
      { key: "biciklisticka-carapa", sr: "Biciklistička", en: "Cycling" },
      { key: "fitnes-carapa", sr: "Fitnes", en: "Fitness" },
      { key: "sport-polu-termo-stopalo", sr: "Polu-termo", en: "Mid-thermal" },
      { key: "skijaska-termo", sr: "Skijaška", en: "Ski" },
      { key: "lovacka-termo-carapa", sr: "Lovačka", en: "Hunting" },
    ],
  },
  {
    id: "dokolenice",
    sr: "Dokolenice",
    en: "Knee-highs",
    items: [
      { key: "dokolenica", sr: "Klasična", en: "Classic" },
      { key: "folklorna-dokolenica", sr: "Folklorna", en: "Folk" },
      { key: "odbojkaska-dokolenica", sr: "Odbojkaška", en: "Volleyball" },
      { key: "lovacka-termo-dokolenica", sr: "Lovačka", en: "Hunting" },
    ],
  },
  {
    id: "nadkolenice",
    sr: "Nadkolenice",
    en: "Over-the-knee",
    items: [{ key: "nadkolenica", sr: "Nadkolenice", en: "Over-the-knee" }],
  },
  {
    id: "stucne",
    sr: "Štucne",
    en: "Football socks",
    items: [{ key: "stucna", sr: "Štucne", en: "Football socks" }],
  },
  {
    id: "deciji-sport",
    sr: "Dečiji sport",
    en: "Kids' sport",
    items: [{ key: "sport-kids", sr: "Dečiji sport", en: "Kids' sport", rename: true }],
  },
  {
    id: "bez-gumice",
    sr: "Bez gumice",
    en: "Soft cuff",
    items: [
      { key: "klasicna-carapa-bez-gumice", sr: "Klasična", en: "Classic" },
      { key: "termo-bez-gumice", sr: "Termo", en: "Thermal" },
    ],
  },
];

const PLACED = new Map<string, { family: TypeFamily; item: TypeItem; sort: number }>();
TYPE_FAMILIES.forEach((family, familyIndex) => {
  family.items.forEach((item, itemIndex) => {
    PLACED.set(item.key, { family, item, sort: familyIndex * 20 + itemIndex });
  });
});

export function describeType(key: string) {
  return PLACED.get(canonicalTypeKey(key)) ?? null;
}

export type TypeChoice = {
  key: string;
  label: string;
  labelEn: string;
  group: string;
  groupEn: string;
  sort: number;
};

export function groupTypeOptions(options: TypeChoice[], locale: "sr" | "en") {
  const sections: { label: string; items: { key: string; label: string }[] }[] = [];
  const index = new Map<string, { label: string; items: { key: string; label: string }[] }>();
  for (const option of [...options].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "sr"))) {
    const group = locale === "en" ? option.groupEn : option.group;
    const label = locale === "en" ? option.labelEn : option.label;
    let section = index.get(group);
    if (!section) {
      section = { label: group, items: [] };
      index.set(group, section);
      sections.push(section);
    }
    section.items.push({ key: option.key, label });
  }
  return sections;
}

export function typeChipLabel(option: Pick<TypeChoice, "label" | "labelEn" | "group" | "groupEn">, locale: "sr" | "en") {
  const label = locale === "en" ? option.labelEn : option.label;
  const group = locale === "en" ? option.groupEn : option.group;
  return label === group ? label : `${group} · ${label}`;
}

export function categoryTypeLabel(
  category: { nameSr: string; nameEn: string | null },
  locale: "sr" | "en",
  mode: "short" | "title",
) {
  const raw = typeKey(category.nameSr);
  const placed = describeType(raw);
  const original = locale === "en" && category.nameEn ? category.nameEn : category.nameSr;
  if (!placed) return original;
  const next = locale === "en" ? placed.item.en : placed.item.sr;
  if (mode === "short") return next;
  if (raw !== placed.item.key || placed.item.rename) return next;
  return original;
}

export function groupChildCategories<T extends { id: string; slug: string; nameSr: string; nameEn: string | null }>(
  children: T[],
  locale: "sr" | "en",
) {
  const sections: { id: string; label: string; items: { id: string; slug: string; label: string }[] }[] = [];
  const index = new Map<string, (typeof sections)[number]>();
  const ranked = [...children].sort((a, b) => {
    const left = describeType(typeKey(a.nameSr))?.sort ?? 1000;
    const right = describeType(typeKey(b.nameSr))?.sort ?? 1000;
    return left - right || a.nameSr.localeCompare(b.nameSr, "sr");
  });
  for (const child of ranked) {
    const placed = describeType(typeKey(child.nameSr));
    const id = placed?.family.id ?? "ostalo";
    const label = placed ? (locale === "en" ? placed.family.en : placed.family.sr) : locale === "en" ? "Other" : "Ostalo";
    let section = index.get(id);
    if (!section) {
      section = { id, label, items: [] };
      index.set(id, section);
      sections.push(section);
    }
    const short = categoryTypeLabel(child, locale, "short");
    const taken = section.items.some((item) => item.label === short);
    section.items.push({
      id: child.id,
      slug: child.slug,
      label: taken ? categoryTypeLabel(child, locale, "title") : short,
    });
  }
  return sections;
}

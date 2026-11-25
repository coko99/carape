export const QUOTE_STATUSES = ["draft", "pending_approval", "sent", "viewed", "accepted", "rejected", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["pending_approval", "rejected"],
  pending_approval: ["sent", "draft", "rejected"],
  sent: ["viewed", "accepted", "rejected", "expired"],
  viewed: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus) {
  return TRANSITIONS[from].includes(to);
}

export function quoteTotals(input: {
  lines: { quantity: number; unitPriceMinor: number; discountMinor: number }[];
  shippingMinor: number | null;
  taxMinor: number | null;
}) {
  for (const line of input.lines) {
    if (line.quantity < 1 || line.unitPriceMinor < 0 || line.discountMinor < 0) return null;
    if (line.discountMinor > line.unitPriceMinor * line.quantity) return null;
  }
  const goodsMinor = input.lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const discountMinor = input.lines.reduce((sum, line) => sum + line.discountMinor, 0);
  const shipping = input.shippingMinor ?? 0;
  const tax = input.taxMinor ?? 0;
  if (shipping < 0 || tax < 0) return null;
  const totalMinor = goodsMinor - discountMinor + shipping + tax;
  if (totalMinor < 0) return null;
  return {
    goodsMinor,
    discountMinor,
    shippingMinor: input.shippingMinor,
    taxMinor: input.taxMinor,
    totalMinor,
    totalKnown: input.shippingMinor != null,
  };
}

export function quoteIsOpen(status: QuoteStatus, validUntil: Date, now: Date) {
  if (now > validUntil) return false;
  return status === "sent" || status === "viewed" || status === "accepted";
}

export function canConvertQuote(input: { status: QuoteStatus; validUntil: Date; now: Date; orderId: string | null }) {
  if (input.orderId) return false;
  if (input.now > input.validUntil) return false;
  return input.status === "accepted";
}

export const DESIGN_STATUSES = [
  "novi_upit",
  "u_pripremi_ponude",
  "ponuda_poslata",
  "ceka_potvrdu",
  "odobreno",
  "u_proizvodnji",
  "spremno_za_slanje",
  "zavrseno",
  "otkazano",
] as const;

export type DesignStatus = (typeof DESIGN_STATUSES)[number];

const DESIGN_NEXT: Record<DesignStatus, DesignStatus[]> = {
  novi_upit: ["u_pripremi_ponude", "otkazano"],
  u_pripremi_ponude: ["ponuda_poslata", "otkazano"],
  ponuda_poslata: ["ceka_potvrdu", "otkazano"],
  ceka_potvrdu: ["odobreno", "u_pripremi_ponude", "otkazano"],
  odobreno: ["u_proizvodnji", "otkazano"],
  u_proizvodnji: ["spremno_za_slanje", "otkazano"],
  spremno_za_slanje: ["zavrseno"],
  zavrseno: [],
  otkazano: [],
};

export function canTransitionDesign(from: DesignStatus, to: DesignStatus) {
  return DESIGN_NEXT[from].includes(to);
}

export function logoFileAllowed(input: { name: string; type: string; size: number; head: Uint8Array }) {
  if (input.size < 1 || input.size > 5 * 1024 * 1024) return false;
  const lower = input.name.toLowerCase();
  const head = Buffer.from(input.head).toString("utf8");
  if (lower.endsWith(".png")) return input.head[0] === 0x89 && input.head[1] === 0x50;
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return input.head[0] === 0xff && input.head[1] === 0xd8;
  if (lower.endsWith(".pdf")) return head.startsWith("%PDF");
  if (lower.endsWith(".svg")) {
    if (!input.type.includes("svg") && !head.includes("<svg")) return false;
    return !/<script|onload=|onerror=|javascript:/i.test(head);
  }
  return false;
}

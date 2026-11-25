import { eq } from "drizzle-orm";
import { requireDb } from "@/db";
import { quotationItems, quotations } from "@/db/schema";
import { formatRsd } from "@/lib/commerce";
import { textPdf } from "@/lib/pdf-doc";
import { company } from "@/content/copy";
import { requireStaff } from "@/server/admin";
import { readSettings } from "@/server/seed";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireStaff("quotes");
  const { id } = await context.params;
  const db = await requireDb();
  const [quote] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!quote) return new Response("Nema ponude", { status: 404 });
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
  const settings = await readSettings(db);
  const lines = [
    "ZA-JO KOMERC",
    company.legalName,
    `${company.address}, ${company.postalCode} ${company.city}`,
    company.email,
    `PIB: ${settings.companyPib ?? "nije unet"}`,
    `MB: ${settings.companyMb ?? "nije unet"}`,
    "",
    `Ponuda ${quote.number}`,
    "Ovo nije fiskalni racun i nije faktura.",
    `Kupac: ${quote.buyerName}`,
    `Imejl: ${quote.buyerEmail}`,
    `PIB kupca: ${quote.buyerPib ?? "nije unet"}`,
    `Adresa: ${quote.buyerAddress ?? "nije uneta"}`,
    `Vazi do: ${quote.validUntil.toISOString().slice(0, 10)}`,
    "",
    ...items.map((item) => `${item.description} | ${item.sku ?? "sifra nije uneta"} | ${item.quantity} | ${formatRsd(item.unitPriceMinor)} | popust ${formatRsd(item.discountMinor)} | ${formatRsd(item.lineTotalMinor)}`),
    "",
    `Roba: ${formatRsd(quote.goodsMinor)}`,
    `Popust: ${formatRsd(quote.discountMinor)}`,
    `Dostava: ${quote.shippingMinor == null ? "nije uneta" : formatRsd(quote.shippingMinor)}`,
    `Porez: ${quote.taxMinor == null ? "nije unet" : formatRsd(quote.taxMinor)}`,
    `Ukupno: ${formatRsd(quote.totalMinor)} RSD`,
    `Placanje: ${quote.paymentTerms ?? "nije uneto"}`,
    `Isporuka: ${quote.deliveryNote ?? "nije uneta"}`,
    quote.notes ?? "",
  ];
  return new Response(Buffer.from(textPdf(lines)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${quote.number}.pdf"` },
  });
}

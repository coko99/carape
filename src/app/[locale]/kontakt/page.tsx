import { takeLocale } from "@/i18n/locale";
import { company } from "@/content/copy";
import { InquiryForm } from "@/components/inquiry-form";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  const sr = locale === "sr";
  return (
    <div className="wrap max-w-3xl py-12">
      <h1 className="text-5xl">{sr ? "Kontakt" : "Contact"}</h1>
      <p className="mt-4 leading-7">
        {company.legalName}<br />
        {company.address}, {company.postalCode} {company.city}<br />
        <a href={`mailto:${company.email}`}>{company.email}</a>
      </p>
      <ul className="mt-4">
        {company.people.map((person) => (
          <li key={person.phone}>{person.name} · <a href={`tel:${person.phone.replace(/\s/g, "")}`}>{person.phone}</a></li>
        ))}
      </ul>
      <InquiryForm locale={locale} type="contact" />
    </div>
  );
}

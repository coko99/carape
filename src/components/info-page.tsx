import { copy, faqs } from "@/content/copy";

export function InfoPage({
  locale,
  title,
  body,
  review = false,
}: {
  locale: "sr" | "en";
  title: string;
  body: string;
  review?: boolean;
}) {
  return (
    <article className="wrap max-w-3xl py-12">
      {review ? (
        <p className="legal-flag">
          {locale === "sr"
            ? "Tekst čeka pravnu proveru. PIB, matični broj i tekući račun nisu pronađeni u javnom katalogu."
            : "This text is waiting for legal review. Tax ID, company number and bank account were not found."}
        </p>
      ) : null}
      <h1 className="mt-4 text-5xl">{title}</h1>
      {body.split("\n\n").map((paragraph) => (
        <p key={paragraph.slice(0, 40)} className="mt-4 leading-7">{paragraph}</p>
      ))}
    </article>
  );
}

export function FaqPage({ locale }: { locale: "sr" | "en" }) {
  return (
    <article className="wrap max-w-3xl py-12">
      <p className="kicker">{locale === "sr" ? "Podrška" : "Support"}</p>
      <h1 className="mt-3 text-5xl">{locale === "sr" ? "Najčešća pitanja" : "Common questions"}</h1>
      <div className="faq-list mt-8">
        {faqs[locale].map(([question, answer]) => (
          <details key={question} className="faq-item">
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </article>
  );
}

export function pageCopy(locale: "sr" | "en", key: keyof typeof copy.sr) {
  return copy[locale][key];
}

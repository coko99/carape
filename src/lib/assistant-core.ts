export type AssistantProduct = {
  name: string;
  slug: string;
  priceMinor: number;
  inStock: boolean;
  stockQuantity: number | null;
  sizes: string[];
  category: string;
};

export type AssistantKnowledge = {
  products: AssistantProduct[];
  faqs: { question: string; answer: string }[];
  shippingMinor: number | null;
  paymentLabels: string[];
  chatEnabled: boolean;
};

export type AssistantCard = { name: string; slug: string; priceMinor: number; availability: string };

export function allowChat(countInWindow: number, limit: number) {
  return countInWindow < limit;
}

export function orderStatusFor(input: { email: string; number: string; orders: { email: string; number: string; status: string }[] }) {
  const match = input.orders.find(
    (order) => order.number === input.number.trim() && order.email.toLowerCase() === input.email.trim().toLowerCase(),
  );
  if (!match) return { ok: false as const };
  return { ok: true as const, status: match.status, number: match.number };
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

export function groundedAnswer(question: string, knowledge: AssistantKnowledge) {
  if (!knowledge.chatEnabled) {
    return { text: "Asistent je isključen.", cards: [] as AssistantCard[], unanswered: false };
  }
  const asked = tokens(question);
  const orderMatch = question.match(/([A-Z]{1,4}-\d{4}-\d+)/i);
  const emailMatch = question.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (orderMatch && !emailMatch) {
    return {
      text: "Za status porudžbine potrebni su broj porudžbine i imejl adresa sa porudžbine. Sam broj nije dovoljan.",
      cards: [] as AssistantCard[],
      unanswered: false,
    };
  }
  if (/logo|po meri|personaliz|veleprod|500 par|1000 par/i.test(question)) {
    return {
      text: "Izrada sa logom i veleprodaja idu kroz upit. Otvorite Dizajniraj svoje čarape ili Veleprodaju. Cena izrade nije objavljena dok ponuda nije poslata.",
      cards: [] as AssistantCard[],
      unanswered: false,
    };
  }
  if (/dostav|poštar|postarin/i.test(question)) {
    return {
      text:
        knowledge.shippingMinor == null
          ? "Cena dostave još nije potvrđena. Biće navedena pre slanja."
          : `Potvrđena cena dostave je ${knowledge.shippingMinor} para. Besplatna dostava važi samo ako je prag podešen i dostignut.`,
      cards: [] as AssistantCard[],
      unanswered: false,
    };
  }
  if (/plaćanj|placanj|pouzeć|uplat/i.test(question)) {
    return {
      text: `Plaćanje: ${knowledge.paymentLabels.join(", ")}. Podaci kartice se ne unose na sajtu.`,
      cards: [] as AssistantCard[],
      unanswered: false,
    };
  }
  const faq = knowledge.faqs.find((item) => tokens(item.question).some((token) => asked.includes(token)));
  const cards = knowledge.products
    .map((product) => {
      const haystack = tokens(`${product.name} ${product.category} ${product.sizes.join(" ")}`);
      const score = asked.filter((token) => haystack.includes(token)).length;
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ product }) => ({
      name: product.name,
      slug: product.slug,
      priceMinor: product.priceMinor,
      availability:
        !product.inStock
          ? "Nije na stanju"
          : product.stockQuantity == null
            ? "Na stanju, količina nije objavljena"
            : `Dostupno: ${product.stockQuantity}`,
    }));
  if (cards.length === 0 && !faq) {
    return {
      text: "U katalogu nema poklapanja za to pitanje. Mogu da pomognem oko naziva, veličine, dostave i plaćanja iz objavljenih podataka.",
      cards,
      unanswered: true,
    };
  }
  const lead = cards.length
    ? "Ovo su proizvodi iz kataloga koji odgovaraju pitanju. Cena i stanje su pročitani iz baze, nisu procenjeni."
    : faq?.answer ?? "";
  return { text: faq && cards.length ? `${faq.answer} ${lead}` : lead, cards, unanswered: false };
}

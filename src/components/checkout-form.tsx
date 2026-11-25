"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/navigation";
import { checkoutSchema, type CheckoutInput } from "@/lib/validators";
import { placeOrderAction } from "@/server/actions";

export function CheckoutForm({
  locale,
  labels,
}: {
  locale: "sr" | "en";
  labels: {
    title: string;
    contact: string;
    address: string;
    payment: string;
    cod: string;
    bank: string;
    bankNote: string;
    coupon: string;
    note: string;
    place: string;
    name: string;
    email: string;
    errors: Record<string, string>;
  };
}) {
  const router = useRouter();
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [error, setError] = useState("");
  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      idempotencyKey,
      locale,
      paymentMethod: "cod",
      line2: "",
      note: "",
      couponCode: "",
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        setError("");
        const result = await placeOrderAction(values);
        if (result.ok) router.push({ pathname: "/porudzbina/[number]", params: { number: result.number } });
        else setError(labels.errors[result.error] || labels.errors.failed);
      })}
    >
      <h1 className="text-5xl">{labels.title}</h1>
      <fieldset className="grid gap-3 border border-line p-4">
        <legend>{labels.contact}</legend>
        <label className="field"><span>{labels.name}</span><input {...form.register("name")} autoComplete="name" /></label>
        <label className="field"><span>{labels.email}</span><input type="email" {...form.register("email")} autoComplete="email" /></label>
        <label className="field"><span>Telefon</span><input {...form.register("phone")} autoComplete="tel" /></label>
      </fieldset>
      <fieldset className="grid gap-3 border border-line p-4">
        <legend>{labels.address}</legend>
        <label className="field"><span>{locale === "sr" ? "Ulica i broj" : "Street"}</span><input {...form.register("line1")} autoComplete="address-line1" /></label>
        <label className="field"><span>{locale === "sr" ? "Dodatak" : "Line 2"}</span><input {...form.register("line2")} /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="field"><span>{locale === "sr" ? "Grad" : "City"}</span><input {...form.register("city")} autoComplete="address-level2" /></label>
          <label className="field"><span>{locale === "sr" ? "Poštanski broj" : "Postal code"}</span><input {...form.register("postalCode")} inputMode="numeric" autoComplete="postal-code" /></label>
        </div>
      </fieldset>
      <fieldset className="grid gap-3 border border-line p-4">
        <legend>{labels.payment}</legend>
        <label className="flex gap-2"><input type="radio" value="cod" {...form.register("paymentMethod")} /> {labels.cod}</label>
        <label className="flex gap-2"><input type="radio" value="bank_transfer" {...form.register("paymentMethod")} /> {labels.bank}</label>
        <p className="text-sm text-muted">{labels.bankNote}</p>
        <label className="field"><span>{labels.coupon}</span><input {...form.register("couponCode")} /></label>
        <label className="field"><span>{locale === "sr" ? "Bodovi lojalnosti" : "Loyalty points"}</span><input type="number" min={0} {...form.register("loyaltyPoints", { setValueAs: (value) => (value === "" || value == null ? undefined : Number(value)) })} /></label>
        <label className="field"><span>{labels.note}</span><textarea {...form.register("note")} rows={3} /></label>
      </fieldset>
      {error ? <p role="alert" className="text-clay">{error}</p> : null}
      {Object.entries(form.formState.errors).map(([key, value]) =>
        value?.message ? (
          <p key={key} role="alert" className="text-clay">
            {String(value.message)}
          </p>
        ) : null,
      )}
      <button className="btn" type="submit" disabled={form.formState.isSubmitting}>{labels.place}</button>
    </form>
  );
}

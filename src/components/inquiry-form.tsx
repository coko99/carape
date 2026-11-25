"use client";

import { useState } from "react";
import { submitWholesale } from "@/server/actions";

export function InquiryForm({ locale, type }: { locale: "sr" | "en"; type: "wholesale" | "contact" }) {
  const [status, setStatus] = useState("");
  const sr = locale === "sr";
  return (
    <form
      className="mt-8 grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await submitWholesale(new FormData(event.currentTarget));
        setStatus(result.ok ? (sr ? "Upit je sačuvan." : "Enquiry saved.") : (sr ? "Proverite polja." : "Check the fields."));
      }}
    >
      <input type="hidden" name="type" value={type} />
      {type === "wholesale" ? <label className="field"><span>{sr ? "Firma" : "Company"}</span><input name="organization" required /></label> : <input type="hidden" name="organization" value="Kontakt" />}
      <label className="field"><span>{sr ? "Ime" : "Name"}</span><input name="name" required /></label>
      <label className="field"><span>Email</span><input name="email" type="email" required /></label>
      <label className="field"><span>{sr ? "Telefon" : "Phone"}</span><input name="phone" /></label>
      {type === "wholesale" ? (
        <>
          <label className="field"><span>{sr ? "Količine" : "Quantities"}</span><input name="quantities" /></label>
          <label className="field"><span>{sr ? "Interesovanje" : "Interest"}</span><input name="interests" /></label>
          <label className="field"><span>{sr ? "Crtež ili logo" : "Sketch or logo"}</span><input name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" /></label>
        </>
      ) : null}
      <label className="field"><span>{sr ? "Poruka" : "Message"}</span><textarea name="message" required minLength={10} rows={5} /></label>
      <button className="btn w-fit" type="submit">{sr ? "Pošalji" : "Send"}</button>
      {status ? <p role="status">{status}</p> : null}
    </form>
  );
}

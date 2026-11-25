"use client";

import { useState } from "react";
import { saveDesignAction } from "@/server/design-actions";

export function DesignStudio({
  models,
  email,
  projectId,
}: {
  models: { id: string; name: string; colors: string[] }[];
  email: string;
  projectId?: string;
}) {
  const [step, setStep] = useState(0);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const model = models.find((item) => item.id === modelId) ?? models[0];
  const [base, setBase] = useState(model?.colors[0] ?? "");
  const [accent, setAccent] = useState(model?.colors[1] ?? "");
  const [x, setX] = useState(50);
  const [y, setY] = useState(40);
  const [scale, setScale] = useState(30);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (!model) return null;
  return (
    <form className="grid gap-6 lg:grid-cols-[1fr_0.8fr]" action={async (formData) => {
      formData.set("modelId", modelId);
      formData.set("base", base);
      formData.set("accent", accent);
      formData.set("x", String(x));
      formData.set("y", String(y));
      formData.set("scale", String(scale));
      if (projectId) formData.set("projectId", projectId);
      if (file) formData.set("logo", file);
      const result = await saveDesignAction(formData);
      setMessage(result.ok ? "Upit je sačuvan. Prikaz je ilustracija i nije obavezujuća cena." : "Upit nije sačuvan. Proverite fajl i model.");
    }}>
      <div>
        <p>Korak {step + 1} od 5</p>
        {step === 0 ? (
          <fieldset className="mt-4 grid gap-2">
            <legend>Model</legend>
            {models.map((item) => <label key={item.id} className="flex gap-2"><input type="radio" checked={modelId === item.id} onChange={() => { setModelId(item.id); setBase(item.colors[0] ?? ""); }} />{item.name}</label>)}
          </fieldset>
        ) : null}
        {step === 1 ? (
          <fieldset className="mt-4 grid gap-2">
            <legend>Boje iz odobrenog modela</legend>
            {model.colors.map((color) => <label key={color} className="flex gap-2"><input type="radio" checked={base === color} onChange={() => setBase(color)} />{color}</label>)}
            <label className="field"><span>Akcenat</span><select value={accent} onChange={(event) => setAccent(event.target.value)}><option value="">Bez akcenta</option>{model.colors.map((color) => <option key={color}>{color}</option>)}</select></label>
          </fieldset>
        ) : null}
        {step === 2 ? (
          <fieldset className="mt-4 grid gap-3">
            <legend>Logo</legend>
            <input type="file" accept=".png,.jpg,.jpeg,.svg,.pdf" onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              setPreview(next && next.type.startsWith("image/") ? URL.createObjectURL(next) : null);
            }} />
            <label className="field"><span>Položaj X</span><input type="range" min={10} max={90} value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
            <label className="field"><span>Položaj Y</span><input type="range" min={10} max={90} value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
            <label className="field"><span>Veličina</span><input type="range" min={10} max={70} value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label>
            <button type="button" className="underline w-fit" onClick={() => { setX(50); setY(40); setScale(30); setFile(null); setPreview(null); }}>Reset</button>
          </fieldset>
        ) : null}
        {step === 3 ? (
          <fieldset className="mt-4 grid gap-3">
            <legend>Količine</legend>
            <label className="field"><span>Ukupno pari</span><input name="quantity" type="number" min={1} required /></label>
            <label className="field"><span>Raspodela veličina</span><textarea name="sizes" required rows={4} /></label>
            <label className="field"><span>Pakovanje</span><input name="packaging" /></label>
            <label className="field"><span>Napomena za proizvodnju</span><textarea name="instructions" rows={3} /></label>
          </fieldset>
        ) : null}
        {step === 4 ? (
          <fieldset className="mt-4 grid gap-3">
            <legend>Upit za ponudu</legend>
            <label className="field"><span>Ime</span><input name="contact" required /></label>
            <label className="field"><span>Imejl</span><input name="email" type="email" defaultValue={email} required /></label>
            <label className="field"><span>Telefon</span><input name="phone" required /></label>
            <p>Pošaljite upit za ponudu. Konačna cena ne postoji dok je proizvođač ne potvrdi.</p>
          </fieldset>
        ) : null}
        <div className="mt-4 flex gap-3">
          {step > 0 ? <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Nazad</button> : null}
          {step < 4 ? <button type="button" className="btn" onClick={() => setStep(step + 1)}>Dalje</button> : <button className="btn" type="submit">Pošaljite upit za ponudu.</button>}
        </div>
        {message ? <p className="mt-3" role="status">{message}</p> : null}
      </div>
      <div>
        <p className="text-sm text-muted">Ilustracija. Ne prikazuje tačan proizvodni otisak.</p>
        <div className="relative mt-3 h-80 rounded-t-full bg-paper-2" style={{ background: base || "#ddd" }}>
          {preview ? <img src={preview} alt="Položaj loga" className="absolute object-contain" style={{ left: `${x}%`, top: `${y}%`, width: `${scale}%`, transform: "translate(-50%, -50%)" }} /> : null}
          {accent ? <div className="absolute inset-x-8 top-8 h-6" style={{ background: accent }} /> : null}
        </div>
      </div>
    </form>
  );
}

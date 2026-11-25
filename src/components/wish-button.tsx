"use client";

export function WishButton({ slug, label }: { slug: string; label: string }) {
  return (
    <button
      className="btn ghost mt-3"
      type="button"
      onClick={() => {
        const current = JSON.parse(localStorage.getItem("zajo-wish") || "[]") as string[];
        localStorage.setItem("zajo-wish", JSON.stringify([slug, ...current.filter((item) => item !== slug)]));
      }}
    >
      {label}
    </button>
  );
}

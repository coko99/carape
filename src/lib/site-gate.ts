export const SITE_PASSWORD = "1706";
export const GATE_COOKIE = "zajo_gate";

export async function gateToken() {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`zajo-ulaz:${SITE_PASSWORD}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/";
  return value;
}

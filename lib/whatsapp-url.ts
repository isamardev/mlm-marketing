/** Digits only for wa.me (include country code, no +). */
export function digitsOnlyPhone(input: string): string {
  return String(input ?? "").replace(/\D/g, "");
}

/** `https://wa.me/92300…` or null if no digits. */
export function whatsappMeUrlFromRawNumber(raw: string | null | undefined): string | null {
  const d = digitsOnlyPhone(String(raw ?? ""));
  if (!d) return null;
  return `https://wa.me/${d}`;
}

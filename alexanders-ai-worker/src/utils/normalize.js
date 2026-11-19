export function normalizeText(text) {
  if (!text) return "";

  return text
    .toLowerCase()
    .trim()
    // Remove Arabic diacritics (tashkeel) and tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    // Unify Arabic letter variants
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    // Strip punctuation and symbols, keep Arabic/Latin letters and digits
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    // Collapse repeated whitespace
    .replace(/\s+/g, " ")
    .trim();
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import { normalizeText, sha256Hex } from "../utils/normalize.js";

const CACHE_TTL_SECONDS = 86400; // 24 hours

const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|hola|good morning|good evening)$/,
  /^(اهلا|اهلا وسهلا|مرحبا|السلام عليكم|سلام عليكم|ازيك|ازيكم|عامل ايه|عاملين ايه|صباح الخير|مساء الخير|هالو|هاي|الو)$/,
];

const THANKS_PATTERNS = [
  /^(thanks|thank you|thx|ty|ok|okay|cool|great|bye|goodbye)$/,
  /^(شكرا|شكراً|متشكر|تسلم|تسلم ايدك|الف شكر|يعطيك العافيه|تمام|ماشي|اوكي|باي|سلام)$/,
];

export function matchInstantReply(userMessage) {
  const norm = normalizeText(userMessage);
  if (!norm) return null;

  if (GREETING_PATTERNS.some((re) => re.test(norm))) {
    return "أهلاً بك في ألكساندرز! إزاي أقدر أساعدك النهاردة؟";
  }

  if (THANKS_PATTERNS.some((re) => re.test(norm))) {
    return "العفو! لو عندك أي سؤال تاني عن الكيان أو اللجان، أنا موجود دايماً.";
  }

  return null;
}

async function buildCacheUrl(kbVersion, userMessage) {
  const norm = normalizeText(userMessage);
  const hash = await sha256Hex(norm);
  return `https://cache.internal/qa/${encodeURIComponent(kbVersion)}/${hash}`;
}

export async function getCachedAnswer(kbVersion, userMessage) {
  try {
    const cacheUrl = await buildCacheUrl(kbVersion, userMessage);
    const cached = await caches.default.match(cacheUrl);
    if (!cached) return null;
    return await cached.json();
  } catch (err) {
    console.warn("[Cache] Read error:", err.message);
    return null;
  }
}

export async function setCachedAnswer(kbVersion, userMessage, payload, ctx) {
  try {
    const cacheUrl = await buildCacheUrl(kbVersion, userMessage);
    const response = new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });

    const writePromise = caches.default.put(cacheUrl, response);
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(writePromise);
    } else {
      await writePromise;
    }
  } catch (err) {
    console.warn("[Cache] Write error:", err.message);
  }
}

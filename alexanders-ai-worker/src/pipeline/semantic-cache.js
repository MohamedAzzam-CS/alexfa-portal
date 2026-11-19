import { cosineSimilarity, toUnitFloat32 } from "../utils/vector.js";

const SIMILARITY_THRESHOLD = 0.92;
const MAX_ENTRIES = 150;
const KV_TTL_SECONDS = 86400; // 24 hours

// Isolate-level in-memory cache: { version: string, entries: Array<{ vec: Float32Array, payload: object }> }
let memoryCache = { version: null, entries: [] };

function kvKey(kbVersion) {
  return `SEMANTIC_CACHE:${kbVersion}`;
}

async function loadEntries(env, kbVersion) {
  if (memoryCache.version === kbVersion) {
    return memoryCache.entries;
  }

  let entries = [];
  if (env.CMS_KV && typeof env.CMS_KV.get === "function") {
    try {
      const raw = await env.CMS_KV.get(kvKey(kbVersion), { type: "json" });
      if (Array.isArray(raw)) {
        entries = raw
          .filter((e) => Array.isArray(e?.v) && e?.p?.reply)
          .map((e) => ({ vec: toUnitFloat32(e.v), payload: e.p }));
      }
    } catch (err) {
      console.warn("[SemanticCache] KV read error:", err.message);
    }
  }

  memoryCache = { version: kbVersion, entries };
  return entries;
}

export async function getSemanticCachedAnswer(env, kbVersion, queryVec) {
  if (!queryVec) return null;

  const entries = await loadEntries(env, kbVersion);
  let bestScore = -1;
  let bestPayload = null;

  for (const entry of entries) {
    const score = cosineSimilarity(queryVec, entry.vec);
    if (score > bestScore) {
      bestScore = score;
      bestPayload = entry.payload;
    }
  }

  if (bestScore >= SIMILARITY_THRESHOLD && bestPayload) {
    return { ...bestPayload, similarity: Number(bestScore.toFixed(4)) };
  }

  return null;
}

export function setSemanticCachedAnswer(env, kbVersion, queryVec, payload, ctx) {
  if (!queryVec || !payload?.reply) return;

  const writeTask = (async () => {
    try {
      const entries = await loadEntries(env, kbVersion);

      // Avoid storing near-duplicates
      const alreadyExists = entries.some(
        (e) => cosineSimilarity(queryVec, e.vec) >= 0.96
      );
      if (alreadyExists) return;

      entries.unshift({ vec: queryVec, payload });
      if (entries.length > MAX_ENTRIES) {
        entries.length = MAX_ENTRIES;
      }
      memoryCache = { version: kbVersion, entries };

      if (env.CMS_KV && typeof env.CMS_KV.put === "function") {
        // Round floats to 4 decimals to keep KV payload compact
        const serialized = entries.map((e) => ({
          v: Array.from(e.vec, (n) => Math.round(n * 10000) / 10000),
          p: e.payload,
        }));

        await env.CMS_KV.put(kvKey(kbVersion), JSON.stringify(serialized), {
          expirationTtl: KV_TTL_SECONDS,
        });
      }
    } catch (err) {
      console.warn("[SemanticCache] Write error:", err.message);
    }
  })();

  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(writeTask);
  }
}

import { cosineSimilarity, embedTexts, toUnitFloat32 } from "../utils/vector.js";

const ADVISOR_ANCHORS = [
  "انصحني اختار اي لجنة مناسبة ليا ولمهاراتي وميولي",
  "ازاي استعد للانترفيو وايه الاسئلة اللي بتتسأل في المقابلة",
  "محتار بين اللجان ومش عارف اقدم على ايه",
];

const TEMP_ANCHORS = [
  "امتى معاد التقديم والانترفيو والديدلاين",
  "ايه الايفنتات والكورسات والاعلانات الحالية دلوقتي",
];

const LONG_SECTIONS = new Set(["SEC_04", "SEC_05"]);

// Isolate-level cache: { version, sections: [{ id, vec }], advisorVecs, tempVecs }
let routerVecCache = null;

function parseIndexLines(indexText) {
  return (indexText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([A-Z0-9_]+)\s*:\s*(.+)$/);
      return match ? { id: match[1], text: match[2].trim() } : null;
    })
    .filter(Boolean);
}

async function loadRouterVectors(env, kbMeta, ctx) {
  if (routerVecCache && routerVecCache.version === kbMeta.version) {
    return routerVecCache;
  }

  const kvKey = `ROUTER_VECS:${kbMeta.version}`;

  if (env.CMS_KV && typeof env.CMS_KV.get === "function") {
    try {
      const cached = await env.CMS_KV.get(kvKey, { type: "json" });
      if (cached && Array.isArray(cached.sections)) {
        routerVecCache = {
          version: kbMeta.version,
          sections: cached.sections.map((s) => ({ id: s.id, vec: toUnitFloat32(s.v) })),
          advisorVecs: (cached.advisor || []).map((v) => toUnitFloat32(v)),
          tempVecs: (cached.temp || []).map((v) => toUnitFloat32(v)),
        };
        return routerVecCache;
      }
    } catch (err) {
      console.warn("[Router] KV vector read error:", err.message);
    }
  }

  const parsedSections = parseIndexLines(kbMeta.indexText);
  const allTexts = [
    ...parsedSections.map((s) => s.text),
    ...ADVISOR_ANCHORS,
    ...TEMP_ANCHORS,
  ];

  const allVecs = await embedTexts(env, allTexts);
  const secCount = parsedSections.length;
  const advCount = ADVISOR_ANCHORS.length;

  const sections = parsedSections.map((s, i) => ({ id: s.id, vec: allVecs[i] }));
  const advisorVecs = allVecs.slice(secCount, secCount + advCount);
  const tempVecs = allVecs.slice(secCount + advCount);

  routerVecCache = { version: kbMeta.version, sections, advisorVecs, tempVecs };

  if (env.CMS_KV && typeof env.CMS_KV.put === "function") {
    const round = (vec) => Array.from(vec, (n) => Math.round(n * 10000) / 10000);
    const payload = {
      sections: sections.map((s) => ({ id: s.id, v: round(s.vec) })),
      advisor: advisorVecs.map(round),
      temp: tempVecs.map(round),
    };
    const putPromise = env.CMS_KV.put(kvKey, JSON.stringify(payload), {
      expirationTtl: 86400 * 7,
    });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(putPromise);
    }
  }

  return routerVecCache;
}

function maxScore(queryVec, vecs) {
  let best = -1;
  for (const v of vecs) {
    const score = cosineSimilarity(queryVec, v);
    if (score > best) best = score;
  }
  return best;
}

export async function routeMessage(env, userMessage, history, kbMeta, queryVec, ctx) {
  try {
    const vecs = await loadRouterVectors(env, kbMeta, ctx);

    const scoredSections = vecs.sections
      .map((s) => ({ id: s.id, score: cosineSimilarity(queryVec, s.vec) }))
      .sort((a, b) => b.score - a.score);

    const topScore = scoredSections[0]?.score ?? 0;
    const selected = scoredSections
      .filter((s, idx) => idx === 0 || (idx < 3 && (s.score >= topScore - 0.06 || s.score >= 0.58)))
      .map((s) => s.id);

    const advisorScore = maxScore(queryVec, vecs.advisorVecs);
    const tempScore = maxScore(queryVec, vecs.tempVecs);

    const isAdvisor = advisorScore >= 0.62 && advisorScore >= topScore - 0.03;
    const mode = isAdvisor ? "ADVISOR" : "KB_FACT";
    const needsTempData = Boolean(kbMeta.tempTitles) && tempScore >= 0.55;

    // Stream for coaching, multi-section answers, or list-heavy sections (promotions / 6 committees)
    const stream =
      mode === "ADVISOR" ||
      selected.length >= 2 ||
      selected.some((id) => LONG_SECTIONS.has(id));

    return {
      mode,
      sections: selected.length > 0 ? selected : ["SEC_01", "SEC_03", "SEC_05"],
      needsTempData,
      stream,
      directReply: null,
    };
  } catch (err) {
    console.warn("[Router] Vector routing fallback:", err.message);
    return {
      mode: "KB_FACT",
      sections: ["SEC_01", "SEC_03", "SEC_05"],
      needsTempData: Boolean(kbMeta.tempTitles),
      stream: true,
      directReply: null,
    };
  }
}

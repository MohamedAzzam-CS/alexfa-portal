/**
 * ==============================================================================
 * ALEXANDERS AI CHATBOT PROXY WORKER
 * ==============================================================================
 * Features:
 * 1. CORS protection (alexfa.me, pages.dev, localhost).
 * 2. Dynamic multi-API key discovery (scales from 3 to N keys via GEMINI_KEY_*).
 * 3. Actively supported models cascade (gemini-3.1-flash-lite, gemini-3.8-flash, gemini-2.0-flash).
 * 4. Dynamic prompt loading ready for Admin CMS (Cloudflare KV -> Env Var -> Safe default).
 * 5. Multi-key round-robin with automatic 429/503 quota failover.
 * ==============================================================================
 */

// ==============================================================================
// Step 1: CORS & Origin Whitelist
// ==============================================================================
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)*pages\.dev$/,
  /^https:\/\/([a-z0-9-]+\.)*alexfa\.me$/,
  /^https:\/\/alexfa\.me$/,
];

const CORE_BASE_PROMPT = `أنت المساعد الذكي الرسمي لكيان "ألكساندرز" (ALEXANDERS) الطلابي بجامعة الإسكندرية.
أسلوبك: ودود، عملي، ومختصر جداً باللهجة المصرية، وتجاوب في سطور قليلة ومباشرة بدون تطويل.

قواعد أساسية:
- اعتمد فقط على المعلومات المكتوبة هنا. لو اتسألت عن حاجة مش موجودة أو مش متأكد منها، قول بوضوح إن المعلومة مش متاحة حالياً واطلب من السائل يتواصل مع الصفحة الرسمية للكيان.
- ممنوع تأليف أي مواعيد، روابط، أو شروط مش مذكورة.

[1] التعريف والتبعية:
- كيان طلابي رسمي تابع لإدارة جامعة الإسكندرية (الإدارة العامة لرعاية الشباب - إدارة الأسر الطلابية) تحت إشراف أ.د/ نائب رئيس الجامعة لشؤون التعليم والطلاب.

[2] الأنشطة والمميزات:
- تدريبات، كورسات، سيشنز، ندوات، وإيفنتات لتطوير المهارات (Soft & Hard Skills) وتجهيز الطلاب لسوق العمل مع تركيز على التنمية المستدامة، بالإضافة لرحلات وزيارات ميدانية.
- كل الأنشطة مجانية 100%، ومعظمها بشهادات معتمدة، وأحياناً بدلات انتقال للزيارات الميدانية.

[3] شروط الانضمام ونظام العضوية:
- متاح حصرياً لـ: طلبة جامعة الإسكندرية وجامعة الإسكندرية الأهلية (أي كلية أو فرقة).
- غير متاح لـ: الخريجين، طلبة سنة الامتياز، أو طلبة المعاهد والجامعات الأخرى.
- العضوية نوعان:
  1. Active Member: تختار لجنة وتعمل interview، وليك دور فعال وأولوية دائماً في الإيفنتات والرحلات والكورسات والورش.
  2. General Member: تنضم بدون مسؤوليات داخل اللجان.

[4] نظام المتابعة والالتزام (HR Policy):
- المطلوب: الجدية، الالتزام بالمواعيد والتاسكات، والتواصل السريع، مع مراعاة الكلية والامتحانات (الحضور مش يومي).
- كل عضو معاه HR Follower بيتابعه ويساعده.
- سياسة الإنذارات (3 Strikes): بحد أقصى 3 تحذيرات لتجاهل الـ HR، الغياب المتكرر بدون عذر، أو إهمال التاسكات؛ بعد التالت يتم الاستبعاد (Filtration) فوراً.
- العضو المميز (VIP): يُكرم شهرياً وبياخد أولوية مطلقة وتسهيلات خاصة في كل ما يخص الكيان.

[5] هيكل ولجان الكيان (6 لجان):
1. لجنة التنظيم (OC): الإدارة الميدانية، التخطيط اللوجستي، وإدارة الفعاليات على أرض الواقع.
2. لجنة الموارد البشرية (HR): إدارة الأفراد، متابعة وتقييم الأعضاء، وتوفير بيئة عمل متوازنة.
3. لجنة العلاقات العامة (PR): التمثيل الرسمي، التواصل الخارجي، عقد الشراكات، وتأمين الرعايات.
4. لجنة الميديا (Media): الإنتاج الرقمي، التوثيق المرئي، إدارة المحتوى، والتصميم الجرافيكي.
5. اللجنة الفنية (Handmade): الإنتاج الفني، تصميم وتنفيذ ديكورات الأنشطة، وإعادة التدوير.
6. لجنة البرمجة (Programming): الدعم التقني، الحلول البرمجية، والبنية التحتية التكنولوجية للكيان.`;

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");

  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  if (isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

// ==============================================================================
// Step 2: Full-Fleet Model Cascade & Payload Adapter
// ==============================================================================
const ALL_CHAT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
  "gemini-pro-latest",
  "gemini-2.5-pro",
];

function getCandidateModels(env) {
  const primary = (env.PRIMARY_MODEL || "").trim();
  if (!primary) return [...ALL_CHAT_MODELS];
  return [primary, ...ALL_CHAT_MODELS.filter((m) => m !== primary)];
}

function buildModelPayload(model, contents, systemInstruction, maxTokens = 140) {
  const isGemma = model.startsWith("gemma-");
  const isGemini25 = model.includes("2.5");
  const isProOnly = model.includes("-pro");

  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: maxTokens,
    topP: 0.8,
  };

  if (isGemini25) {
    if (!isProOnly) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  } else if (model.includes("3.1") || model.includes("3.5") || model.includes("3.6")) {
    generationConfig.thinkingConfig = { thinkingLevel: "minimal" };
  } else if (model.includes("3.7") || model.includes("3.8") || isGemma) {
    generationConfig.thinkingConfig = { thinkingLevel: "low" };
  }

  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig,
  };
}

// ==============================================================================
// Step 2.5: One-Time Calibration Beacon & Time-Decaying Score Dictionary
// ==============================================================================
const SCORE_CACHE_URL = "https://scores.internal/model-scores-v2";
const PENALTY_HALF_LIFE_SEC = 120; // Penalties decay by 50% every 2 minutes

async function loadScoreState() {
  try {
    const res = await caches.default.match(SCORE_CACHE_URL);
    if (!res) return null; // Null signals cold start -> triggers one-time calibration beacon
    return await res.json();
  } catch {
    return null;
  }
}

async function saveScoreState(state, ctx) {
  try {
    const req = caches.default.put(
      SCORE_CACHE_URL,
      new Response(JSON.stringify(state), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
        },
      })
    );
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(req);
    else await req;
  } catch {}
}

// Runs ONCE on cold start using ONLY the locked beaconKeys (e.g. Keys #6 & #7)
async function runInitialCalibrationBeacon(models, beaconKeys, ctx) {
  const pingContents = [{ role: "user", parts: [{ text: "ok" }] }];
  const baseKeyIdx = Math.floor(Math.random() * beaconKeys.length);

  const probes = models.map(async (model, idx) => {
    const apiKey = beaconKeys[(baseKeyIdx + idx) % beaconKeys.length];
    const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
    const start = Date.now();

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildModelPayload(model, pingContents, "Reply with 1 word.", 2)),
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Empty");

    return { model, tookMs: Date.now() - start };
  });

  const results = await Promise.allSettled(probes);
  const scores = {};
  let healthyCount = 0;

  results.forEach((outcome, idx) => {
    const model = models[idx];
    if (outcome.status === "fulfilled") {
      scores[model] = outcome.value.tookMs; // Initial score = actual measured latency (ms)
      healthyCount++;
    } else {
      scores[model] = 50000; // Penalize dead/congested models right away
    }
  });

  const state = { scores, updatedAt: Date.now() };
  await saveScoreState(state, ctx);
  console.log(`[Initial Beacon] Calibrated ${healthyCount}/${models.length} live models.`, scores);

  return { state, healthyCount };
}

// Decays old penalties over elapsed time so throttled models gradually re-enter rotation
function getDecayedScores(state, models) {
  const elapsedSec = Math.max(0, (Date.now() - (state.updatedAt || Date.now())) / 1000);
  const decayMultiplier = Math.pow(0.5, elapsedSec / PENALTY_HALF_LIFE_SEC);

  const decayed = {};
  for (const m of models) {
    const raw = typeof state.scores[m] === "number" ? state.scores[m] : 1000;
    decayed[m] = raw > 1500
      ? Math.max(1200, Math.round(raw * decayMultiplier))
      : raw;
  }
  return decayed;
}

// ==============================================================================
// Step 3: Dynamic System Prompt / CMS Knowledge Loader
// ==============================================================================
async function getSystemInstruction(env) {
  let dynamicLayer = "";

  // 1. First priority: Cloudflare KV namespace connected to Admin CMS
  if (env.CMS_KV && typeof env.CMS_KV.get === "function") {
    try {
      const kvPrompt = await env.CMS_KV.get("SYSTEM_INSTRUCTION");
      if (kvPrompt && kvPrompt.trim().length > 10) {
        dynamicLayer = `\n\n${kvPrompt.trim()}`;
      }
    } catch (err) {
      console.warn("[CMS] KV read error, falling back to env:", err.message);
    }
  }

  // 2. Second priority: Environment variable in Cloudflare Dashboard (links & active updates)
  if (!dynamicLayer && env.SYSTEM_INSTRUCTION && env.SYSTEM_INSTRUCTION.trim().length > 10) {
    dynamicLayer = `\n\n${env.SYSTEM_INSTRUCTION.trim()}`;
  }

  // 3. Combine static core facts with dynamic layer (or return static core alone if none set)
  return `${CORE_BASE_PROMPT}${dynamicLayer}`;
}

// ==============================================================================
// Step 4: Dynamic API Key Discovery & Pool Partitioning (Chat vs. Beacon)
// ==============================================================================
function getPartitionedKeys(env) {
  let allKeys = Object.keys(env)
    .filter((name) => name.startsWith("GEMINI_KEY_") && env[name])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) // Handles GEMINI_KEY_1..GEMINI_KEY_10+ cleanly
    .map((name) => env[name].trim())
    .filter(Boolean);

  if (allKeys.length === 0 && env.GEMINI_KEYS) {
    allKeys = env.GEMINI_KEYS.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }

  if (allKeys.length <= 2) {
    return { allKeys, chatKeys: allKeys, beaconKeys: allKeys };
  }

  // Lock the last 2 keys (e.g., Keys #6 & #7) for the calibration beacon
  const beaconKeys = allKeys.slice(-2);
  const chatKeys = allKeys.slice(0, -2);

  return { allKeys, chatKeys, beaconKeys };
}

// ==============================================================================
// Step 5: Score-Sorted Generation Engine (Zero Post-Calibration Beacons)
// ==============================================================================
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PER_ATTEMPT_TIMEOUT_MS = 2200;
const MAX_TOTAL_WALL_MS = 7000;
const MAX_KEY_RETRIES_PER_MODEL = 2;

async function generateChatReply(contents, keyPools, candidateModels, systemInstruction, ctx) {
  const { chatKeys, beaconKeys } = keyPools;
  const engineStart = Date.now();
  let state = await loadScoreState();

  // 1. Cold-Start Gate: Run initial beacon ONCE using ONLY locked beaconKeys (Keys #6 & #7)
  if (!state || !state.scores) {
    const calibration = await runInitialCalibrationBeacon(candidateModels, beaconKeys, ctx);
    if (calibration.healthyCount === 0) {
      throw new Error("خدمة الذكاء الاصطناعي غير متاحة حالياً (جميع النماذج مشغولة)، يرجى المحاولة بعد قليل.");
    }
    state = calibration.state;
  }

  // 2. Decay existing scores by elapsed time and sort ascending (lowest score = fastest/healthiest)
  const scores = getDecayedScores(state, candidateModels);
  const rankedModels = [...candidateModels].sort((a, b) => scores[a] - scores[b]);

  let lastError = null;
  const attemptTrace = [];
  const startKeyIndex = Math.floor(Math.random() * chatKeys.length);
  const maxAttempts = Math.min(chatKeys.length, MAX_KEY_RETRIES_PER_MODEL);

  for (const model of rankedModels) {
    if (Date.now() - engineStart > MAX_TOTAL_WALL_MS) {
      lastError = "تجاوز الطلب الحد الأقصى للانتظار.";
      break;
    }

    const payload = buildModelPayload(model, contents, systemInstruction, 140);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() - engineStart > MAX_TOTAL_WALL_MS) break;

      const keyIndex = (startKeyIndex + attempt) % chatKeys.length;
      const apiKey = chatKeys[keyIndex];
      const attemptStart = Date.now();
      const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
        });

        const tookMs = Date.now() - attemptStart;

        // Per-key quota throttle (429) -> slight score bump, rotate to next chat key
        if (response.status === 429) {
          attemptTrace.push({ model, key: keyIndex + 1, status: 429, tookMs });
          scores[model] += 1500;
          await saveScoreState({ scores, updatedAt: Date.now() }, ctx);
          lastError = `Chat Key #${keyIndex + 1} throttled on ${model}`;
          continue;
        }

        // Model-level error (503 congestion, 404 unavailable, 400 invalid arg) -> penalize & skip immediately
        if (response.status === 503 || response.status === 404 || response.status === 400) {
          const errData = await response.json().catch(() => ({}));
          const reason = errData.error?.message || `HTTP ${response.status}`;
          attemptTrace.push({ model, key: keyIndex + 1, status: response.status, tookMs, reason });

          scores[model] += response.status === 503 ? 15000 : 50000;
          await saveScoreState({ scores, updatedAt: Date.now() }, ctx);
          lastError = `${model} unavailable (HTTP ${response.status})`;
          break;
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          lastError = errData.error?.message || `HTTP ${response.status}`;
          continue;
        }

        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (replyText) {
          // Reward successful model by updating its EWMA latency score
          scores[model] = Math.round(scores[model] * 0.7 + tookMs * 0.3);
          await saveScoreState({ scores, updatedAt: Date.now() }, ctx);

          return {
            reply: replyText,
            modelUsed: model,
            modelScore: scores[model],
          };
        }

        lastError = `Empty response from ${model}`;
      } catch (err) {
        const tookMs = Date.now() - attemptStart;
        const isTimeout = err.name === "TimeoutError";
        attemptTrace.push({ model, key: keyIndex + 1, status: isTimeout ? "TIMEOUT" : "ERR", tookMs });

        if (isTimeout) {
          scores[model] += 15000;
          await saveScoreState({ scores, updatedAt: Date.now() }, ctx);
          lastError = `${model} timed out`;
          break;
        }
        lastError = err.message;
      }
    }
  }

  await saveScoreState({ scores, updatedAt: Date.now() }, ctx);
  const finalError = new Error(lastError || "جميع مفاتيح الخدمة مشغولة حالياً، يرجى إعادة المحاولة خلال ثوانٍ.");
  finalError.trace = attemptTrace;
  throw finalError;
}
// ==============================================================================
// Step 6: Worker Export Fetch Handler (Main Entry Point)
// ==============================================================================
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request);

    // 1. Handle Browser Preflight OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const origin = request.headers.get("Origin");
    if (origin && !isOriginAllowed(origin)) {
      return new Response(
        JSON.stringify({ error: "Origin not allowed." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Enforce POST
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Please use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();

    try {
      const body = await request.json().catch(() => ({}));
      const userMessage = (body.message || "").trim();
      const history = Array.isArray(body.history) ? body.history : [];

      if (!userMessage) {
        return new Response(
          JSON.stringify({ error: "حقل الرسالة مطلوب (message is required)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Discover and partition keys (chatKeys vs. locked beaconKeys)
      const keyPools = getPartitionedKeys(env);
      if (keyPools.allKeys.length === 0) {
        return new Response(
          JSON.stringify({
            error: "لم يتم ضبط أي مفاتيح API في بيئة الـ Worker (No GEMINI_KEY_* configured).",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Load dynamic prompt and candidate models
      const systemInstruction = await getSystemInstruction(env);
      const candidateModels = getCandidateModels(env);

      // Build conversation context (last 4 turns)
      const contents = [];
      const recentHistory = history.slice(-4);
      for (const turn of recentHistory) {
        if (turn && turn.text && turn.role) {
          contents.push({
            role: turn.role === "assistant" ? "model" : "user",
            parts: [{ text: turn.text }],
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: userMessage }],
      });

      // Execute request with isolated key pools and score-sorted model ranking
      const result = await generateChatReply(contents, keyPools, candidateModels, systemInstruction, ctx);
      const latencyMs = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          reply: result.reply,
          model: result.modelUsed,
          modelScore: result.modelScore,
          latencyMs: latencyMs,
          chatPoolSize: keyPools.chatKeys.length,
          beaconPoolSize: keyPools.beaconKeys.length,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      console.error("[Worker Failed]", JSON.stringify({ error: err.message, latencyMs, trace: err.trace }));
      return new Response(
        JSON.stringify({
          error: err.message || "حدث خطأ غير متوقع أثناء معالجة الطلب.",
          latencyMs: latencyMs,
          trace: err.trace || [],
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  },
};

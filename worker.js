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
// Step 2: Modern Gemini Models Cascade (Only Actively Supported Models)
// ==============================================================================
const DEFAULT_PRIMARY_MODEL = "gemini-3.1-flash-lite";

const BACKUP_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

function getCandidateModels(env) {
  const primary = (env.PRIMARY_MODEL || DEFAULT_PRIMARY_MODEL).trim();
  const models = [primary];

  for (const m of BACKUP_MODELS) {
    if (!models.includes(m)) {
      models.push(m);
    }
  }
  return models;
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
// Step 4: Dynamic API Key Discovery (Scales from 3 to N keys automatically)
// ==============================================================================
function getApiKeys(env) {
  const discoveredKeys = Object.keys(env)
    .filter((name) => name.startsWith("GEMINI_KEY_") && env[name])
    .map((name) => env[name].trim())
    .filter(Boolean);

  if (discoveredKeys.length === 0 && env.GEMINI_KEYS) {
    return env.GEMINI_KEYS.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }

  return discoveredKeys;
}

// ==============================================================================
// Step 5: Core Generation Engine with Multi-Key Pool & Model Fallback
// ==============================================================================
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PER_ATTEMPT_TIMEOUT_MS = 8000;

async function generateChatReply(contents, keys, candidateModels, systemInstruction) {
  let lastError = null;
  const startKeyIndex = Math.floor(Math.random() * keys.length);

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const keyIndex = (startKeyIndex + attempt) % keys.length;
      const apiKey = keys[keyIndex];

      const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
      const payload = {
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 120,
          topP: 0.8,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      };

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
        });

        // 1. Quota or demand throttle (429 / 503) -> Rotate to NEXT KEY
        if (response.status === 429 || response.status === 503) {
          console.warn(`[Key Failover] Key index ${keyIndex} throttled (${response.status}) on ${model}. Trying next key...`);
          lastError = `Key #${keyIndex + 1} throttled on ${model} (HTTP ${response.status})`;
          continue;
        }

        // 2. Model deprecated or not found (404) -> Skip remaining keys, switch to NEXT MODEL
        if (response.status === 404) {
          console.warn(`[Model Failover] Model ${model} returned 404. Switching to fallback model...`);
          lastError = `Model ${model} unavailable (HTTP 404)`;
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
          return {
            reply: replyText,
            modelUsed: model,
            keyIndexUsed: keyIndex,
          };
        }

        lastError = `Empty response from ${model} (Key #${keyIndex + 1})`;
      } catch (err) {
        lastError = err.name === "TimeoutError"
          ? `Key #${keyIndex + 1} timed out on ${model}`
          : err.message;
      }
    }
  }

  throw new Error(lastError || "جميع مفاتيح الخدمة مشغولة حالياً، يرجى إعادة المحاولة خلال ثوانٍ.");
}

// ==============================================================================
// Step 6: Worker Export Fetch Handler (Main Entry Point)
// ==============================================================================
export default {
  async fetch(request, env) {
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

      // Discover keys dynamically from environment (GEMINI_KEY_*)
      const keys = getApiKeys(env);
      if (keys.length === 0) {
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

      // Execute request with multi-key pool and model cascade
      const result = await generateChatReply(contents, keys, candidateModels, systemInstruction);
      const latencyMs = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          reply: result.reply,
          model: result.modelUsed,
          latencyMs: latencyMs,
          poolSize: keys.length,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          error: err.message || "حدث خطأ غير متوقع أثناء معالجة الطلب.",
          latencyMs: latencyMs,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  },
};

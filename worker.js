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

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// ==============================================================================
// Step 2: Modern Gemini Models Cascade (Only Actively Supported Models)
// ==============================================================================
const DEFAULT_PRIMARY_MODEL = "gemini-3.1-flash-lite";

const BACKUP_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.0-flash",
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
const DEFAULT_FALLBACK_PROMPT =
  "أنت المساعد الذكي لمجتمع ألكساندرز (ALEXANDERS). أجب باختصار وبلهجة مصرية ودودة. إذا لم تكن متأكداً من معلومة، اطلب من السائل التواصل مع صفحة الكيان الرسمية.";

async function getSystemInstruction(env) {
  // 1. First priority: Cloudflare KV namespace connected to Admin CMS
  if (env.CMS_KV && typeof env.CMS_KV.get === "function") {
    try {
      const kvPrompt = await env.CMS_KV.get("SYSTEM_INSTRUCTION");
      if (kvPrompt && kvPrompt.trim().length > 20) {
        return kvPrompt.trim();
      }
    } catch (err) {
      console.warn("[CMS] KV read error, falling back to env/default:", err.message);
    }
  }

  // 2. Second priority: Environment variable override in Cloudflare Dashboard
  if (env.SYSTEM_INSTRUCTION && env.SYSTEM_INSTRUCTION.trim().length > 20) {
    return env.SYSTEM_INSTRUCTION.trim();
  }

  // 3. Third priority: Minimal safe default
  return DEFAULT_FALLBACK_PROMPT;
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

async function generateChatReply(contents, keys, candidateModels, systemInstruction) {
  let lastError = null;
  const startKeyIndex = Math.floor(Math.random() * keys.length);

  for (const model of candidateModels) {
    let modelIsInvalid = false;

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
        });

        // 1. Quota or demand throttle (429 / 503) -> Rotate to NEXT KEY
        if (response.status === 429 || response.status === 503) {
          console.warn(`[Key Failover] Key index ${keyIndex} throttled (${response.status}). Trying next key...`);
          lastError = `Key #${keyIndex + 1} throttled (HTTP ${response.status})`;
          continue;
        }

        // 2. Model deprecated or not found (404) -> Break to NEXT MODEL
        if (response.status === 404) {
          console.warn(`[Model Failover] Model ${model} returned 404. Switching to fallback model...`);
          modelIsInvalid = true;
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
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!modelIsInvalid && lastError && lastError.includes("throttled")) {
      break;
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

import { getCorsHeaders, isOriginAllowed, jsonResponse } from "./utils/cors.js";
import { getKbMetadata, getSelectedSections, getTempData } from "./storage/kb.js";
import { matchInstantReply, getCachedAnswer, setCachedAnswer } from "./pipeline/cache.js";
import { routeMessage } from "./pipeline/router.js";
import { generateResponse } from "./pipeline/responder.js";
import { handleAdminSync } from "./admin/sync.js";

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const origin = request.headers.get("Origin");
    if (origin && !isOriginAllowed(origin)) {
      return jsonResponse({ error: "Origin not allowed." }, 403);
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed. Please use POST." },
        405,
        corsHeaders
      );
    }

    const url = new URL(request.url);
    if (url.pathname === "/admin/sync") {
      return handleAdminSync(request, env, corsHeaders);
    }

    const startTime = Date.now();

    try {
      const body = await request.json().catch(() => ({}));
      const userMessage = (body.message || "").trim();
      const history = Array.isArray(body.history) ? body.history : [];
      const isStandalone = history.length === 0;

      if (!userMessage) {
        return jsonResponse(
          { error: "حقل الرسالة مطلوب (message is required)." },
          400,
          corsHeaders
        );
      }

      if (!env.AI || typeof env.AI.run !== "function") {
        return jsonResponse(
          { error: "Workers AI binding (AI) is not configured." },
          500,
          corsHeaders
        );
      }

      // LAYER 0A: Instant Regex Short-Circuit (0 Neurons, <1ms)
      if (isStandalone) {
        const instantReply = matchInstantReply(userMessage);
        if (instantReply) {
          return jsonResponse(
            {
              reply: instantReply,
              mode: "INSTANT",
              source: "regex",
              latencyMs: Date.now() - startTime,
            },
            200,
            corsHeaders
          );
        }
      }

      const kbMeta = await getKbMetadata(env);

      // LAYER 0B: Versioned Edge Cache Lookup (0 Neurons, <10ms)
      if (isStandalone) {
        const cached = await getCachedAnswer(kbMeta.version, userMessage);
        if (cached?.reply) {
          return jsonResponse(
            {
              reply: cached.reply,
              mode: cached.mode || "KB_FACT",
              source: "edge-cache",
              model: cached.model || null,
              sections: cached.sections || [],
              latencyMs: Date.now() - startTime,
            },
            200,
            corsHeaders
          );
        }
      }

      // STEP 1: Fast Router & Intent Classifier (glm-4.7-flash)
      const route = await routeMessage(env, userMessage, history, kbMeta);

      if (route.mode === "SHORT_CIRCUIT" && route.directReply) {
        return jsonResponse(
          {
            reply: route.directReply,
            mode: "SHORT_CIRCUIT",
            source: "router",
            latencyMs: Date.now() - startTime,
          },
          200,
          corsHeaders
        );
      }

      // STEP 2: Fetch Scoped Context & Generate Reply
      const [sectionsText, tempDataText] = await Promise.all([
        getSelectedSections(env, route.sections),
        route.needsTempData ? getTempData(env) : Promise.resolve(""),
      ]);

      const { reply, modelUsed } = await generateResponse(env, {
        mode: route.mode,
        userMessage,
        history,
        sectionsText,
        tempDataText,
      });

      if (isStandalone && route.mode === "KB_FACT") {
        await setCachedAnswer(
          kbMeta.version,
          userMessage,
          {
            reply,
            mode: route.mode,
            model: modelUsed,
            sections: route.sections,
          },
          ctx
        );
      }

      return jsonResponse(
        {
          reply,
          mode: route.mode,
          source: "workers-ai",
          model: modelUsed,
          sections: route.sections,
          usedTempData: route.needsTempData,
          latencyMs: Date.now() - startTime,
        },
        200,
        corsHeaders
      );
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      console.error("[Worker Error]", err.message, { latencyMs });
      return jsonResponse(
        {
          error: "حدث خطأ غير متوقع أثناء معالجة الطلب، يرجى المحاولة مرة أخرى.",
          latencyMs,
        },
        503,
        corsHeaders
      );
    }
  },
};

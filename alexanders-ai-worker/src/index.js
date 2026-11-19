import { getCorsHeaders, jsonResponse } from "./utils/cors.js";
import { getKbMetadata, getSelectedSections, getTempData } from "./storage/kb.js";
import { matchInstantReply, getCachedAnswer, setCachedAnswer } from "./pipeline/cache.js";
import { getSemanticCachedAnswer, setSemanticCachedAnswer } from "./pipeline/semantic-cache.js";
import { routeMessage } from "./pipeline/router.js";
import { generateResponse, generateStreamResponse } from "./pipeline/responder.js";
import { embedText } from "./utils/vector.js";
import { handleAdminSync } from "./admin/sync.js";
import { handleSaveUser, handleListUsers } from "./admin/users.js";

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/admin/sync") {
      return handleAdminSync(request, env, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/users") {
      return handleSaveUser(request, env, corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/admin/users") {
      return handleListUsers(request, env, corsHeaders);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed. Use POST." }, 405, corsHeaders);
    }

    const body = await request.json().catch(() => null);
    const userMessage = typeof body?.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!userMessage) {
      return jsonResponse({ error: "Missing 'message' in request body." }, 400, corsHeaders);
    }

    const isStandalone = history.length === 0;

    // Layer 0A: Instant Regex Short-Circuit (<1ms, 0 Neurons)
    const instantReply = matchInstantReply(userMessage);
    if (instantReply) {
      return jsonResponse(
        { reply: instantReply, meta: { layer: "0A_REGEX", cached: true } },
        200,
        corsHeaders
      );
    }

    const kbMeta = await getKbMetadata(env);

    // Layer 0B: Exact Edge Cache (SHA-256)
    if (isStandalone) {
      const exactHit = await getCachedAnswer(kbMeta.version, userMessage);
      if (exactHit?.reply) {
        return jsonResponse(
          { ...exactHit, meta: { ...(exactHit.meta || {}), layer: "0B_EXACT_CACHE", cached: true } },
          200,
          corsHeaders
        );
      }
    }

    // Single Embedding Call (~50ms) -> powers both Semantic Cache & Vector Router
    let queryVec = null;
    try {
      const embedInput =
        !isStandalone && history.length > 0
          ? `${history[history.length - 1]?.text || ""} ${userMessage}`.trim()
          : userMessage;
      queryVec = await embedText(env, embedInput);
    } catch (err) {
      console.warn("[Pipeline] Embedding failed:", err.message);
    }

    // Layer 0C: Semantic Cache (>= 0.92 cosine similarity)
    if (isStandalone && queryVec) {
      const semanticHit = await getSemanticCachedAnswer(env, kbMeta.version, queryVec);
      if (semanticHit?.reply) {
        // Also populate exact cache for even faster repeat hits
        setCachedAnswer(kbMeta.version, userMessage, { reply: semanticHit.reply, meta: semanticHit.meta }, ctx);
        return jsonResponse(
          {
            reply: semanticHit.reply,
            meta: {
              ...(semanticHit.meta || {}),
              layer: "0C_SEMANTIC_CACHE",
              similarity: semanticHit.similarity,
              cached: true,
            },
          },
          200,
          corsHeaders
        );
      }
    }

    // Step 1: In-Memory Vector Router (~1ms)
    const route = await routeMessage(env, userMessage, history, kbMeta, queryVec, ctx);

    if (route.mode === "SHORT_CIRCUIT" && route.directReply) {
      return jsonResponse(
        { reply: route.directReply, meta: { layer: "STEP1_SHORT_CIRCUIT", cached: false } },
        200,
        corsHeaders
      );
    }

    const [sectionsText, tempDataText] = await Promise.all([
      getSelectedSections(env, route.sections),
      route.needsTempData ? getTempData(env) : Promise.resolve(""),
    ]);

    const cacheReply = (reply, modelUsed) => {
      if (!isStandalone || route.mode !== "KB_FACT" || !reply) return;
      const payload = {
        reply,
        meta: { mode: route.mode, sections: route.sections, modelUsed },
      };
      setCachedAnswer(kbMeta.version, userMessage, payload, ctx);
      if (queryVec) {
        setSemanticCachedAnswer(env, kbMeta.version, queryVec, payload, ctx);
      }
    };

    // Step 2A: SSE Stream for long / multi-section / ADVISOR replies
    if (route.stream) {
      const { stream, modelUsed } = await generateStreamResponse(env, {
        mode: route.mode,
        userMessage,
        history,
        sectionsText,
        tempDataText,
        onComplete: (fullReply, usedModel) => cacheReply(fullReply, usedModel),
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-AI-Mode": route.mode,
          "X-AI-Model": modelUsed,
        },
      });
    }

    // Step 2B: Non-streaming JSON for short, single-fact replies
    const { reply, modelUsed } = await generateResponse(env, {
      mode: route.mode,
      userMessage,
      history,
      sectionsText,
      tempDataText,
    });

    cacheReply(reply, modelUsed);

    return jsonResponse(
      {
        reply,
        meta: {
          layer: "STEP2_JSON",
          mode: route.mode,
          sections: route.sections,
          modelUsed,
          cached: false,
        },
      },
      200,
      corsHeaders
    );
  },
};

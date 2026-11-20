// ============================================================================
// Alexanders Group AI Chat - Cloudflare Worker Backend
// Enforces:
// 1. Strict server-side system prompt & knowledge base isolation
// 2. 21-FAQ Short-Circuit Fast Path (faqId: 1..21, O(1), zero quota impact)
// 3. Hybrid 5-message guest gate (signed HttpOnly cookie + GUEST_QUOTA_KV)
// 4. Puter User-Pays authenticated inference + pre-login sessionId linking
// 5. Temporary ISO-Week partitioned storage via StorageAdapter (KV / R2)
// ============================================================================

import { assembleMessages } from "./system-prompt.js";
import { FAQS, FAQ_CATALOG_VERSION, getFaqById } from "./faqs.js";
import { StorageAdapter, getIsoWeek } from "./storage-adapter.js";
import {
  GUEST_MESSAGE_LIMIT,
  authenticatePuterRequest,
  getGuestQuotaState,
  incrementGuestQuota,
} from "./auth-quota.js";
import { callPuterAiFromWorker } from "./puter-ai.js";

function buildCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

function jsonResponse(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...buildCorsHeaders(request),
      ...extraHeaders,
    },
  });
}

function handleGetFaqs(request) {
  return jsonResponse(
    request,
    {
      version: FAQ_CATALOG_VERSION,
      count: FAQS.length,
      faqs: FAQS,
    },
    200,
    {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    }
  );
}

async function handleGetQuota(request, env, url) {
  const clientSessionId = url.searchParams.get("sessionId");
  const [auth, quota] = await Promise.all([
    authenticatePuterRequest(request, env),
    getGuestQuotaState(request, env, clientSessionId),
  ]);

  return jsonResponse(request, {
    sessionId: quota.sessionId,
    isAuthenticated: auth.isAuthenticated,
    user: auth.isAuthenticated
      ? {
          userId: auth.userId,
          email: auth.email,
          username: auth.username,
        }
      : null,
    guestQuota: {
      count: quota.count,
      limit: GUEST_MESSAGE_LIMIT,
      remaining: quota.remaining,
    },
  });
}

async function handleLinkSession(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      request,
      { error: "INVALID_JSON", message: "Request body must be valid JSON." },
      400
    );
  }

  const auth = await authenticatePuterRequest(request, env);
  if (!auth.isAuthenticated) {
    return jsonResponse(
      request,
      {
        error: "AUTH_REQUIRED",
        message: "Valid Puter authentication token required to link session.",
      },
      401
    );
  }

  const quota = await getGuestQuotaState(request, env, body.sessionId);
  const sessionId = quota.sessionId;
  const isoWeek = getIsoWeek();
  const storage = new StorageAdapter(env);

  const linkResult = await storage.linkSessionToUser(
    sessionId,
    {
      userId: auth.userId,
      email: auth.email || body.email || null,
      username: auth.username || body.username || null,
    },
    isoWeek
  );

  return jsonResponse(request, {
    ok: true,
    sessionId,
    isoWeek,
    linkedCount: linkResult.linkedCount,
    user: {
      userId: auth.userId,
      email: auth.email || body.email || null,
      username: auth.username || body.username || null,
    },
  });
}

async function handleChatRequest(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      request,
      { error: "INVALID_JSON", message: "Request body must be valid JSON." },
      400
    );
  }

  // ==========================================================================
  // 0. 21-FAQ Short-Circuit Fast Path (faqId: 1..21)
  // Checked BEFORE running quota enforcement or AI inference.
  // ==========================================================================
  if (body?.faqId !== undefined && body?.faqId !== null) {
    const faq = getFaqById(body.faqId);
    if (!faq) {
      return jsonResponse(
        request,
        {
          error: "INVALID_FAQ_ID",
          message: "faqId must be an integer between 1 and 21.",
        },
        400
      );
    }

    const [auth, quotaState] = await Promise.all([
      authenticatePuterRequest(request, env),
      getGuestQuotaState(request, env, body?.sessionId),
    ]);

    const sessionId = quotaState.sessionId;
    const now = new Date();
    const isoWeek = getIsoWeek(now);
    const storage = new StorageAdapter(env);

    // If signed in, ensure pre-login sessionId is linked to authenticated identity
    if (auth.isAuthenticated) {
      const linkPromise = storage.linkSessionToUser(
        sessionId,
        {
          userId: auth.userId,
          email: auth.email,
          username: auth.username,
        },
        isoWeek
      );
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(linkPromise);
      } else {
        await linkPromise;
      }
    }

    // Do NOT increment the guest's 5-message quota counter.
    // Log the FAQ interaction to weekly storage with compact reference fields.
    const turnRecord = {
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      isoWeek,
      type: "faq",
      faqRef: faq.faqRef,
      sessionId,
      isAuthenticated: auth.isAuthenticated,
      userId: auth.isAuthenticated ? auth.userId : null,
      email: auth.isAuthenticated ? auth.email : null,
      username: auth.isAuthenticated ? auth.username : null,
      userMessage: faq.question,
      assistantResponse: faq.answer,
    };

    const logPromise = storage.logChatTurn(turnRecord);
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(logPromise);
    } else {
      await logPromise;
    }

    return jsonResponse(request, {
      id: turnRecord.id,
      type: "faq",
      faqId: faq.id,
      faqRef: faq.faqRef,
      question: faq.question,
      answer: faq.answer,
      reply: faq.answer,
      sessionId,
      isoWeek,
      isAuthenticated: auth.isAuthenticated,
      user: auth.isAuthenticated
        ? {
            userId: auth.userId,
            email: auth.email,
            username: auth.username,
          }
        : null,
      guestQuota: {
        count: quotaState.count,
        limit: GUEST_MESSAGE_LIMIT,
        remaining: quotaState.remaining,
      },
    });
  }

  // ==========================================================================
  // 1. Free-Text AI Chat Pipeline ({ message, history, sessionId })
  // ==========================================================================
  const userMessage = typeof body?.message === "string" ? body.message.trim() : "";
  if (!userMessage) {
    return jsonResponse(
      request,
      { error: "EMPTY_MESSAGE", message: "Message cannot be empty." },
      400
    );
  }
  if (userMessage.length > 4000) {
    return jsonResponse(
      request,
      { error: "MESSAGE_TOO_LONG", message: "Message exceeds maximum length (4000 characters)." },
      400
    );
  }

  const rawHistory = Array.isArray(body?.history) ? body.history : [];
  const hasAuthHeader = Boolean(
    request.headers.get("Authorization")?.match(/^Bearer\s+\S+/i)
  );

  // Inspect Puter Auth Header & Guest Quota
  const [auth, quotaState] = await Promise.all([
    authenticatePuterRequest(request, env),
    getGuestQuotaState(request, env, body?.sessionId),
  ]);

  // If the frontend sent a Bearer token that is expired or invalid, signal re-auth
  if (hasAuthHeader && !auth.isAuthenticated) {
    return jsonResponse(
      request,
      {
        error: "AUTH_REQUIRED",
        message: "Your Puter sign-in session expired or is invalid. Please sign in again.",
        sessionId: quotaState.sessionId,
      },
      401
    );
  }

  const sessionId = quotaState.sessionId;
  const now = new Date();
  const isoWeek = getIsoWeek(now);
  const storage = new StorageAdapter(env);

  let activePuterToken = null;
  let updatedQuota = {
    count: quotaState.count,
    limit: GUEST_MESSAGE_LIMIT,
    remaining: quotaState.remaining,
    setCookieHeader: null,
  };

  // 2. Enforce 5-Message Guest Gate OR Unlimited Authenticated Mode
  if (!auth.isAuthenticated) {
    if (quotaState.count >= GUEST_MESSAGE_LIMIT) {
      return jsonResponse(
        request,
        {
          error: "AUTH_REQUIRED",
          message: "Free guest limit of 5 messages reached. Please sign in to continue.",
          sessionId,
          guestQuota: {
            count: quotaState.count,
            limit: GUEST_MESSAGE_LIMIT,
            remaining: 0,
          },
        },
        403
      );
    }

    // Valid guest turn (count < 5): increment counter atomically in GUEST_QUOTA_KV
    updatedQuota = await incrementGuestQuota(request, env, quotaState);
    activePuterToken = env.GUEST_PUTER_TOKEN || null;
  } else {
    // Authenticated Mode: bypass 5-message limit, use user's own Puter token (User-Pays)
    activePuterToken = auth.token;

    // Link pre-login guest sessionId to newly authenticated userId/email
    const linkPromise = storage.linkSessionToUser(
      sessionId,
      {
        userId: auth.userId,
        email: auth.email,
        username: auth.username,
      },
      isoWeek
    );
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(linkPromise);
    } else {
      await linkPromise;
    }
  }

  // 3. Assemble System Prompt + Dynamic Context + History strictly inside the Worker
  const assembledMessages = assembleMessages({
    message: userMessage,
    history: rawHistory,
    dynamicContext: {
      isoWeek,
      isAuthenticated: auth.isAuthenticated,
      username: auth.username,
    },
  });

  // 4. Execute Puter AI Inference inside the Worker
  let aiResult;
  try {
    aiResult = await callPuterAiFromWorker({
      messages: assembledMessages,
      puterToken: activePuterToken,
      userMessage,
      isGuest: !auth.isAuthenticated,
      env,
    });
  } catch (err) {
    if (err?.isAuthError) {
      return jsonResponse(
        request,
        {
          error: "AUTH_REQUIRED",
          message: "Puter authentication required or session expired. Please sign in to continue.",
          sessionId,
        },
        401
      );
    }
    return jsonResponse(
      request,
      {
        error: "AI_UPSTREAM_ERROR",
        message: "Failed to generate AI response. Please try again.",
        detail: err?.message || "Upstream error",
        sessionId,
      },
      502
    );
  }

  // 5. Log chat turn to Temporary Weekly Storage (partitioned by ISO Week, e.g. "2026-W47")
  const turnRecord = {
    id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    isoWeek,
    type: "chat",
    faqRef: null,
    sessionId,
    isAuthenticated: auth.isAuthenticated,
    userId: auth.isAuthenticated ? auth.userId : null,
    email: auth.isAuthenticated ? auth.email : null,
    username: auth.isAuthenticated ? auth.username : null,
    userMessage,
    assistantResponse: aiResult.reply,
  };

  const logPromise = storage.logChatTurn(turnRecord);
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(logPromise);
  } else {
    await logPromise;
  }

  const extraHeaders = {};
  if (updatedQuota.setCookieHeader) {
    extraHeaders["Set-Cookie"] = updatedQuota.setCookieHeader;
  }

  return jsonResponse(
    request,
    {
      id: turnRecord.id,
      type: "chat",
      faqRef: null,
      reply: aiResult.reply,
      sessionId,
      isoWeek,
      isAuthenticated: auth.isAuthenticated,
      user: auth.isAuthenticated
        ? {
            userId: auth.userId,
            email: auth.email,
            username: auth.username,
          }
        : null,
      guestQuota: {
        count: updatedQuota.count,
        limit: GUEST_MESSAGE_LIMIT,
        remaining: updatedQuota.remaining,
      },
    },
    200,
    extraHeaders
  );
}

export default {
  async fetch(request, env = {}, ctx = {}) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request),
      });
    }

    // API Routes
    if (url.pathname === "/api/faqs" && request.method === "GET") {
      return handleGetFaqs(request);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env, ctx);
    }

    if (url.pathname === "/api/quota" && request.method === "GET") {
      return handleGetQuota(request, env, url);
    }

    if (url.pathname === "/api/auth/link" && request.method === "POST") {
      return handleLinkSession(request, env);
    }

    // Never expose raw knowledge base or internal worker source files via static asset serving
    if (
      url.pathname === "/alexanders_knowledge_base.txt" ||
      url.pathname.startsWith("/worker/") ||
      url.pathname === "/wrangler.toml"
    ) {
      return new Response("Not Found", { status: 404 });
    }

    // Delegate static site assets if running via Cloudflare Workers Assets binding
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse(
      request,
      { error: "NOT_FOUND", message: `Route ${request.method} ${url.pathname} not found.` },
      404
    );
  },
};

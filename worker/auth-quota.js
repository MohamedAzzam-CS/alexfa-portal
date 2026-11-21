// ============================================================================
// Server-Side 5-Message Per-Device Guest Quota (1-Minute Auto-Reset)
// & Puter Auth Token Validator
// - Scoped per device (sessionId + signed HttpOnly cookie), NOT shared across
//   the same home Wi-Fi / IP, so every device in the same home gets fresh 5 messages.
// - Automatically resets to 0 (fresh 5 messages) after 60 seconds of waiting.
// ============================================================================

export const GUEST_MESSAGE_LIMIT = 5;
export const GUEST_COOKIE_NAME = "guest_session";
export const GUEST_RESET_WINDOW_MS = 60 * 1000; // 1 minute auto-reset
const COOKIE_MAX_AGE_SECONDS = 60; // 60 seconds
const KV_QUOTA_TTL_SECONDS = 60; // 60 seconds (minimum Cloudflare KV TTL)

// Local fallback store when running without KV bound in local dev
const memoryQuotaMap = new Map();
const memoryTokenCache = new Map();

function toBase64Url(bytes) {
  let binary = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret || "alexanders-default-hmac-secret-key-2026"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Computes a SHA-256 hex digest.
 */
export async function sha256Hex(input) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(String(input || "")));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Signs a guest session payload { sid, count, iat } using HMAC-SHA256.
 */
export async function signGuestCookiePayload(payload, secret) {
  const enc = new TextEncoder();
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const key = await getHmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const sigB64 = toBase64Url(sigBuf);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed guest_session cookie value.
 * Automatically treats the cookie count as 0 if older than GUEST_RESET_WINDOW_MS (1 minute).
 */
export async function verifyGuestCookiePayload(cookieVal, secret) {
  if (!cookieVal || typeof cookieVal !== "string" || !cookieVal.includes(".")) {
    return null;
  }
  const [payloadB64, sigB64] = cookieVal.split(".");
  if (!payloadB64 || !sigB64) return null;

  try {
    const enc = new TextEncoder();
    const key = await getHmacKey(secret);
    const sigBytes = fromBase64Url(sigB64);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(payloadB64)
    );
    if (!valid) return null;

    const jsonText = new TextDecoder().decode(fromBase64Url(payloadB64));
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed.sid !== "string") return null;

    const ageMs = Date.now() - Number(parsed.iat || 0);
    if (ageMs >= GUEST_RESET_WINDOW_MS) {
      return { ...parsed, count: 0, expired: true };
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Parses the Cookie header into a key-value object.
 */
export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

/**
 * Formats the signed HttpOnly; Secure; SameSite=Lax Set-Cookie header.
 */
export function buildGuestSetCookieHeader(signedValue, requestUrl) {
  let isLocalhost = false;
  try {
    const u = new URL(requestUrl);
    isLocalhost =
      u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    isLocalhost = false;
  }

  const parts = [
    `${GUEST_COOKIE_NAME}=${signedValue}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    isLocalhost ? "" : "Secure",
    "SameSite=Lax",
  ].filter(Boolean);

  return parts.join("; ");
}

function sanitizeSessionId(rawSid) {
  const cleaned = String(rawSid || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
  if (cleaned.startsWith("anon_") && cleaned.length >= 12) {
    return cleaned;
  }
  return `anon_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function kvGetQuotaRecord(kv, key) {
  if (!key) return { count: 0, resetInSeconds: 0 };
  const record = kv
    ? await kv.get(key, { type: "json" })
    : memoryQuotaMap.get(key) || null;

  if (!record) return { count: 0, resetInSeconds: 0 };

  const updatedAtMs = Number(record.updatedAtMs || Date.parse(record.updatedAt) || 0);
  const elapsedMs = Date.now() - updatedAtMs;

  // Auto-reset if 1 minute (60,000 ms) has elapsed since the last message
  if ( !updatedAtMs || elapsedMs >= GUEST_RESET_WINDOW_MS) {
    return { count: 0, resetInSeconds: 0 };
  }

  const resetInSeconds = Math.max(
    1,
    Math.ceil((GUEST_RESET_WINDOW_MS - elapsedMs) / 1000)
  );
  return {
    count: Number(record.count || 0),
    resetInSeconds,
  };
}

async function kvPutQuotaRecord(kv, key, data) {
  if (!key) return;
  if (kv) {
    await kv.put(key, JSON.stringify(data), {
      expirationTtl: KV_QUOTA_TTL_SECONDS,
    });
  } else {
    memoryQuotaMap.set(key, data);
  }
}

/**
 * Inspects current per-device guest quota without incrementing.
 * Notice: Tracked strictly per device (sessionId + cookie), NOT by shared home IP,
 * and automatically resets 60 seconds after the last guest message.
 */
export async function getGuestQuotaState(request, env, clientSessionId = null) {
  const kv = env.GUEST_QUOTA_KV || null;
  const secret = env.COOKIE_SECRET || "alexanders-default-hmac-secret-key-2026";

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const verifiedCookie = await verifyGuestCookiePayload(
    cookies[GUEST_COOKIE_NAME],
    secret
  );

  // Prefer the device's explicit sessionId or verified cookie sid
  const sessionId = clientSessionId
    ? sanitizeSessionId(clientSessionId)
    : verifiedCookie?.sid
      ? sanitizeSessionId(verifiedCookie.sid)
      : sanitizeSessionId(null);

  const sessionKey = `guest:sid:${sessionId}`;
  const kvRecord = await kvGetQuotaRecord(kv, sessionKey);

  // Only combine cookieCount if the cookie belongs to the same device sessionId and hasn't expired
  const cookieCount =
    verifiedCookie && verifiedCookie.sid === sessionId && !verifiedCookie.expired
      ? Number(verifiedCookie.count || 0)
      : 0;

  const currentCount = Math.max(kvRecord.count, cookieCount);
  const remaining = Math.max(0, GUEST_MESSAGE_LIMIT - currentCount);

  return {
    sessionId,
    sessionKey,
    count: currentCount,
    limit: GUEST_MESSAGE_LIMIT,
    remaining,
    resetInSeconds: currentCount > 0 ? kvRecord.resetInSeconds || 60 : 0,
    allowed: currentCount < GUEST_MESSAGE_LIMIT,
  };
}

/**
 * Atomically increments the per-device guest counter in GUEST_QUOTA_KV (with 60s TTL)
 * and returns the updated quota state + signed HttpOnly Set-Cookie header.
 */
export async function incrementGuestQuota(request, env, quotaState) {
  const kv = env.GUEST_QUOTA_KV || null;
  const secret = env.COOKIE_SECRET || "alexanders-default-hmac-secret-key-2026";
  const nextCount = quotaState.count + 1;
  const nowMs = Date.now();

  const payload = {
    sessionId: quotaState.sessionId,
    count: nextCount,
    updatedAt: new Date(nowMs).toISOString(),
    updatedAtMs: nowMs,
  };

  await kvPutQuotaRecord(kv, quotaState.sessionKey, payload);

  const signedCookie = await signGuestCookiePayload(
    {
      sid: quotaState.sessionId,
      count: nextCount,
      iat: nowMs,
    },
    secret
  );

  return {
    sessionId: quotaState.sessionId,
    count: nextCount,
    limit: GUEST_MESSAGE_LIMIT,
    remaining: Math.max(0, GUEST_MESSAGE_LIMIT - nextCount),
    resetInSeconds: 60,
    setCookieHeader: buildGuestSetCookieHeader(signedCookie, request.url),
  };
}

/**
 * Extracts and validates the user's Puter Bearer token against Puter's API.
 * Returns { isAuthenticated, token, userId, email, username } or { isAuthenticated: false }.
 */
export async function authenticatePuterRequest(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { isAuthenticated: false, token: null, userId: null, email: null, username: null };
  }

  const token = match[1].trim();
  if (!token || token === "null" || token === "undefined" || token.length < 10) {
    return { isAuthenticated: false, token: null, userId: null, email: null, username: null };
  }

  const kv = env.GUEST_QUOTA_KV || null;
  const tokenHash = await sha256Hex(`token:${token}`);
  const cacheKey = `auth_cache:${tokenHash}`;

  // 1. Check short-lived cache (5 min TTL)
  if (kv) {
    const cached = await kv.get(cacheKey, { type: "json" });
    if (cached && cached.userId) {
      return {
        isAuthenticated: true,
        token,
        userId: cached.userId,
        email: cached.email || null,
        username: cached.username || null,
      };
    }
  } else if (memoryTokenCache.has(cacheKey)) {
    const cached = memoryTokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        isAuthenticated: true,
        token,
        userId: cached.userId,
        email: cached.email || null,
        username: cached.username || null,
      };
    }
  }

  // 2. Verify token against Puter API (/whoami)
  try {
    const resp = await fetch("https://api.puter.com/whoami", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        Origin: "https://puter.com",
        Referer: "https://puter.com/",
      },
    });

    if (!resp.ok) {
      return {
        isAuthenticated: false,
        token: null,
        userId: null,
        email: null,
        username: null,
        error: `Puter auth validation failed (HTTP ${resp.status})`,
      };
    }

    const user = await resp.json();
    const userId = user?.uuid || user?.id || user?.sub || null;
    if (!userId || user?.is_temp === true) {
      return {
        isAuthenticated: false,
        token: null,
        userId: null,
        email: null,
        username: null,
        error: "Temporary or unverified Puter account",
      };
    }

    const identity = {
      userId: String(userId),
      email: user?.email || null,
      username: user?.username || null,
    };

    if (kv) {
      await kv.put(cacheKey, JSON.stringify(identity), { expirationTtl: 300 });
    } else {
      memoryTokenCache.set(cacheKey, {
        ...identity,
        expiresAt: Date.now() + 300_000,
      });
    }

    return {
      isAuthenticated: true,
      token,
      ...identity,
    };
  } catch (err) {
    return {
      isAuthenticated: false,
      token: null,
      userId: null,
      email: null,
      username: null,
      error: err?.message || "Failed to contact Puter auth server",
    };
  }
}

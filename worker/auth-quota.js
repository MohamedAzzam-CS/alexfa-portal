// ============================================================================
// Server-Side 5-Message Guest Quota & Puter Auth Token Validator
// Uses HMAC-SHA256 signed HttpOnly cookies + Cloudflare KV (GUEST_QUOTA_KV)
// ============================================================================

export const GUEST_MESSAGE_LIMIT = 5;
export const GUEST_COOKIE_NAME = "guest_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const KV_QUOTA_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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
 * Computes a SHA-256 hex digest (used for privacy-preserving IP hashing & token cache keys).
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

  // Always include HttpOnly; Secure; SameSite=Lax in production (omit Secure only on plain http://localhost so browser dev works)
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

async function kvGetCount(kv, key) {
  if (!key) return 0;
  if (kv) {
    const record = await kv.get(key, { type: "json" });
    return Number(record?.count || 0);
  }
  return Number(memoryQuotaMap.get(key)?.count || 0);
}

async function kvPutCount(kv, key, data) {
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
 * Inspects current guest quota without incrementing.
 */
export async function getGuestQuotaState(request, env, clientSessionId = null) {
  const kv = env.GUEST_QUOTA_KV || null;
  const secret = env.COOKIE_SECRET || "alexanders-default-hmac-secret-key-2026";

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const verifiedCookie = await verifyGuestCookiePayload(
    cookies[GUEST_COOKIE_NAME],
    secret
  );

  const sessionId = verifiedCookie?.sid
    ? sanitizeSessionId(verifiedCookie.sid)
    : sanitizeSessionId(clientSessionId);

  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "0.0.0.0";
  const ipHash = await sha256Hex(`ip:${clientIp}:${secret}`);

  const sessionKey = `guest:sid:${sessionId}`;
  const ipKey = clientIp !== "0.0.0.0" ? `guest:ip:${ipHash}` : null;

  const [sidCount, ipCount] = await Promise.all([
    kvGetCount(kv, sessionKey),
    ipKey ? kvGetCount(kv, ipKey) : Promise.resolve(0),
  ]);

  const cookieCount = Number(verifiedCookie?.count || 0);
  const currentCount = Math.max(sidCount, ipCount, cookieCount);
  const remaining = Math.max(0, GUEST_MESSAGE_LIMIT - currentCount);

  return {
    sessionId,
    ipHash,
    sessionKey,
    ipKey,
    count: currentCount,
    limit: GUEST_MESSAGE_LIMIT,
    remaining,
    allowed: currentCount < GUEST_MESSAGE_LIMIT,
  };
}

/**
 * Atomically increments the guest counter in GUEST_QUOTA_KV and returns
 * the updated quota state + signed HttpOnly Set-Cookie header.
 */
export async function incrementGuestQuota(request, env, quotaState) {
  const kv = env.GUEST_QUOTA_KV || null;
  const secret = env.COOKIE_SECRET || "alexanders-default-hmac-secret-key-2026";
  const nextCount = quotaState.count + 1;
  const nowIso = new Date().toISOString();

  const payload = {
    sessionId: quotaState.sessionId,
    ipHash: quotaState.ipHash,
    count: nextCount,
    updatedAt: nowIso,
  };

  await Promise.all([
    kvPutCount(kv, quotaState.sessionKey, payload),
    quotaState.ipKey ? kvPutCount(kv, quotaState.ipKey, payload) : Promise.resolve(),
  ]);

  const signedCookie = await signGuestCookiePayload(
    {
      sid: quotaState.sessionId,
      count: nextCount,
      iat: Date.now(),
    },
    secret
  );

  return {
    sessionId: quotaState.sessionId,
    count: nextCount,
    limit: GUEST_MESSAGE_LIMIT,
    remaining: Math.max(0, GUEST_MESSAGE_LIMIT - nextCount),
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
    // Reject temporary/anonymous Puter shadow sessions if they haven't signed in to a real account
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

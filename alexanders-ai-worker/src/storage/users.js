const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUserInput(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const rawUuid = typeof body.puterUuid === "string" ? body.puterUuid.trim() : "";

  if (!name || name.length > 120) {
    return { ok: false, error: "A valid 'name' (1-120 characters) is required." };
  }

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    return { ok: false, error: "A valid 'email' address is required." };
  }

  const puterUuid = rawUuid ? rawUuid.slice(0, 100) : null;

  return { ok: true, name, email, puterUuid };
}

export async function upsertUser(env, { name, email, puterUuid = null }) {
  if (!env?.USERS_DB) {
    throw new Error("USERS_DB binding is not configured on this Worker.");
  }

  const row = await env.USERS_DB.prepare(
    `INSERT INTO users (puter_uuid, name, email, created_at, last_seen_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       puter_uuid = COALESCE(excluded.puter_uuid, users.puter_uuid),
       last_seen_at = datetime('now')
     RETURNING id, name, email, created_at, last_seen_at`
  )
    .bind(puterUuid || null, name, email)
    .first();

  return row;
}

export async function listUsers(env, { limit = 100, offset = 0 } = {}) {
  if (!env?.USERS_DB) {
    throw new Error("USERS_DB binding is not configured on this Worker.");
  }

  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.min(500, Math.max(1, Math.trunc(parsedLimit)))
    : 100;
  const safeOffset = Number.isFinite(parsedOffset)
    ? Math.max(0, Math.trunc(parsedOffset))
    : 0;

  const [rowsResult, countRow] = await Promise.all([
    env.USERS_DB.prepare(
      `SELECT id, name, email, puter_uuid, created_at, last_seen_at
       FROM users
       ORDER BY last_seen_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(safeLimit, safeOffset)
      .all(),
    env.USERS_DB.prepare(`SELECT COUNT(*) AS total FROM users`).first(),
  ]);

  return {
    total: Number(countRow?.total ?? 0),
    users: rowsResult?.results || [],
  };
}

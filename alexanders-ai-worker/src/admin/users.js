import { isOriginAllowed, jsonResponse } from "../utils/cors.js";
import { validateUserInput, upsertUser, listUsers } from "../storage/users.js";

export async function handleSaveUser(request, env, corsHeaders) {
  const origin = request.headers.get("Origin");
  if (origin && !isOriginAllowed(origin)) {
    return jsonResponse({ error: "Origin not allowed." }, 403, corsHeaders);
  }

  if (!env?.USERS_DB) {
    return jsonResponse(
      { error: "USERS_DB is not configured on this Worker." },
      500,
      corsHeaders
    );
  }

  const body = await request.json().catch(() => null);
  const validated = validateUserInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400, corsHeaders);
  }

  try {
    const user = await upsertUser(env, validated);
    return jsonResponse({ status: "saved", user }, 200, corsHeaders);
  } catch (err) {
    console.error("[Users] Failed to save user:", err?.message || err);
    return jsonResponse({ error: "Failed to save user." }, 500, corsHeaders);
  }
}

export async function handleListUsers(request, env, corsHeaders) {
  const authHeader = request.headers.get("Authorization") || "";
  const expectedSecret = env?.ADMIN_SECRET;

  if (!expectedSecret) {
    return jsonResponse(
      { error: "ADMIN_SECRET is not configured on this Worker." },
      500,
      corsHeaders
    );
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return jsonResponse({ error: "Unauthorized." }, 401, corsHeaders);
  }

  if (!env?.USERS_DB) {
    return jsonResponse(
      { error: "USERS_DB is not configured on this Worker." },
      500,
      corsHeaders
    );
  }

  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit") ?? 100;
    const offset = url.searchParams.get("offset") ?? 0;

    const { total, users } = await listUsers(env, { limit, offset });
    return jsonResponse(
      { total, count: users.length, users },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error("[Users] Failed to list users:", err?.message || err);
    return jsonResponse({ error: "Failed to list users." }, 500, corsHeaders);
  }
}

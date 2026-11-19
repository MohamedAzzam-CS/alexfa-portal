import { jsonResponse } from "../utils/cors.js";
import { parseMarkdownKb } from "../utils/parser.js";

export async function handleAdminSync(request, env, corsHeaders) {
  const authHeader = request.headers.get("Authorization") || "";
  const expectedSecret = env.ADMIN_SECRET;

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

  const body = await request.json().catch(() => null);
  if (!body || (!body.markdown && body.tempData === undefined)) {
    return jsonResponse(
      { error: "Provide at least 'markdown' or 'tempData' in the request body." },
      400,
      corsHeaders
    );
  }

  const newVersion = `v-${Date.now()}`;
  const writes = [env.CMS_KV.put("KB_VERSION", newVersion)];
  let sectionCount = null;
  let indexPreview = null;

  if (typeof body.markdown === "string" && body.markdown.trim()) {
    const parsed = parseMarkdownKb(body.markdown);
    sectionCount = parsed.sectionCount;
    indexPreview = parsed.indexText;

    writes.push(
      env.CMS_KV.put("KB_INDEX", parsed.indexText),
      env.CMS_KV.put("KB_SECTIONS", JSON.stringify(parsed.sectionsMap))
    );
  }

  if (body.tempData !== undefined) {
    if (body.tempData === null || (Array.isArray(body.tempData) && body.tempData.length === 0)) {
      writes.push(env.CMS_KV.delete("TEMP_DATA"));
    } else {
      const ttl = Number(body.tempTtlSeconds);
      const putOptions = Number.isFinite(ttl) && ttl >= 60 ? { expirationTtl: ttl } : undefined;
      const serialized =
        typeof body.tempData === "string" ? body.tempData : JSON.stringify(body.tempData);
      writes.push(env.CMS_KV.put("TEMP_DATA", serialized, putOptions));
    }
  }

  await Promise.all(writes);

  return jsonResponse(
    {
      status: "synced",
      kbVersion: newVersion,
      sectionCount,
      indexPreview,
    },
    200,
    corsHeaders
  );
}

import { MODELS, GENERATION_CONFIG } from "../config/models.js";
import { buildRouterPrompt } from "../config/prompts.js";

function extractAiText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  return (
    result?.choices?.[0]?.message?.content ||
    result?.response ||
    ""
  );
}

function parseRouterJson(rawText) {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Router output did not contain a JSON object");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1));

  const validModes = new Set(["SHORT_CIRCUIT", "KB_FACT", "ADVISOR"]);
  const mode = validModes.has(parsed.mode) ? parsed.mode : "KB_FACT";

  return {
    mode,
    sections: Array.isArray(parsed.sections) ? parsed.sections.slice(0, 3) : [],
    needsTempData: Boolean(parsed.needsTempData),
    directReply:
      mode === "SHORT_CIRCUIT" && typeof parsed.directReply === "string"
        ? parsed.directReply.trim()
        : null,
  };
}

export async function routeMessage(env, userMessage, history, kbMeta) {
  const systemPrompt = buildRouterPrompt(kbMeta.indexText, kbMeta.tempTitles);

  const messages = [{ role: "system", content: systemPrompt }];

  // Include at most the last 2 turns so the router understands follow-up context
  const recentHistory = Array.isArray(history) ? history.slice(-2) : [];
  for (const turn of recentHistory) {
    if (turn?.text && turn?.role) {
      messages.push({
        role: turn.role === "assistant" ? "assistant" : "user",
        content: turn.text,
      });
    }
  }
  messages.push({ role: "user", content: userMessage });

  try {
    const result = await env.AI.run(MODELS.ROUTER, {
      messages,
      temperature: GENERATION_CONFIG.ROUTER.temperature,
      max_completion_tokens: GENERATION_CONFIG.ROUTER.max_tokens,
      chat_template_kwargs: { enable_thinking: false },
    });

    const rawText = extractAiText(result);
    return parseRouterJson(rawText);
  } catch (err) {
    console.warn("[Router] Fallback to default KB_FACT:", err.message);
    return {
      mode: "KB_FACT",
      sections: ["SEC_01", "SEC_03", "SEC_05"],
      needsTempData: true,
      directReply: null,
    };
  }
}

import { MODELS, GENERATION_CONFIG } from "../config/models.js";
import { buildKbFactPrompt, buildAdvisorPrompt } from "../config/prompts.js";

function extractReplyText(result) {
  if (!result) return "";
  if (typeof result === "string") return result.trim();
  const content =
    result?.choices?.[0]?.message?.content ||
    result?.response ||
    "";
  return typeof content === "string" ? content.trim() : "";
}

async function runModel(env, model, messages, config) {
  const payload = {
    messages,
    temperature: config.temperature,
    max_completion_tokens: config.max_tokens,
    chat_template_kwargs: { enable_thinking: false },
  };

  const result = await env.AI.run(model, payload);
  const text = extractReplyText(result);

  if (!text) {
    throw new Error(`Empty response from ${model}`);
  }

  return text;
}

export async function generateResponse(env, { mode, userMessage, history, sectionsText, tempDataText }) {
  const isAdvisor = mode === "ADVISOR";
  const systemPrompt = isAdvisor
    ? buildAdvisorPrompt(sectionsText, tempDataText)
    : buildKbFactPrompt(sectionsText, tempDataText);

  const config = isAdvisor ? GENERATION_CONFIG.ADVISOR : GENERATION_CONFIG.KB_FACT;

  const messages = [{ role: "system", content: systemPrompt }];

  // Attach last 4 turns for conversational continuity
  const recentHistory = Array.isArray(history) ? history.slice(-4) : [];
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
    const reply = await runModel(env, MODELS.RESPONDER, messages, config);
    return { reply, modelUsed: MODELS.RESPONDER };
  } catch (primaryErr) {
    console.warn(`[Responder] Primary model failed (${primaryErr.message}), falling back...`);
    const reply = await runModel(env, MODELS.FALLBACK, messages, config);
    return { reply, modelUsed: MODELS.FALLBACK };
  }
}

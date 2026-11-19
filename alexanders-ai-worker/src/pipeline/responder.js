import { MODELS, GENERATION_CONFIG } from "../config/models.js";
import { buildKbFactPrompt, buildAdvisorPrompt } from "../config/prompts.js";

function extractAiText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  return (
    result?.choices?.[0]?.message?.content ||
    result?.response ||
    ""
  );
}

function buildMessages(mode, userMessage, history, sectionsText, tempDataText) {
  const systemPrompt =
    mode === "ADVISOR"
      ? buildAdvisorPrompt(sectionsText, tempDataText)
      : buildKbFactPrompt(sectionsText, tempDataText);

  const messages = [{ role: "system", content: systemPrompt }];

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
  return messages;
}

function pickModel(mode) {
  return mode === "ADVISOR" ? MODELS.ADVISOR : MODELS.FAST_FACT;
}

function pickConfig(mode) {
  return mode === "ADVISOR" ? GENERATION_CONFIG.ADVISOR : GENERATION_CONFIG.KB_FACT;
}

export async function generateResponse(env, { mode, userMessage, history, sectionsText, tempDataText }) {
  const messages = buildMessages(mode, userMessage, history, sectionsText, tempDataText);
  const primaryModel = pickModel(mode);
  const cfg = pickConfig(mode);

  const runModel = async (model) => {
    const res = await env.AI.run(model, {
      messages,
      temperature: cfg.temperature,
      max_completion_tokens: cfg.max_tokens,
      chat_template_kwargs: { enable_thinking: false },
    });
    const text = extractAiText(res).trim();
    if (!text) throw new Error(`Empty response from ${model}`);
    return text;
  };

  try {
    const reply = await runModel(primaryModel);
    return { reply, modelUsed: primaryModel };
  } catch (err) {
    console.warn(`[Responder] Primary (${primaryModel}) failed, falling back:`, err.message);
    const reply = await runModel(MODELS.FALLBACK);
    return { reply, modelUsed: MODELS.FALLBACK };
  }
}

export async function generateStreamResponse(
  env,
  { mode, userMessage, history, sectionsText, tempDataText, onComplete }
) {
  const messages = buildMessages(mode, userMessage, history, sectionsText, tempDataText);
  const primaryModel = pickModel(mode);
  const cfg = pickConfig(mode);

  let aiStream;
  let modelUsed = primaryModel;

  const openStream = (model) =>
    env.AI.run(model, {
      messages,
      temperature: cfg.temperature,
      max_completion_tokens: cfg.max_tokens,
      stream: true,
      chat_template_kwargs: { enable_thinking: false },
    });

  try {
    aiStream = await openStream(primaryModel);
  } catch (err) {
    console.warn(`[Responder] Stream primary (${primaryModel}) failed, falling back:`, err.message);
    modelUsed = MODELS.FALLBACK;
    aiStream = await openStream(MODELS.FALLBACK);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullReply = "";

  const transform = new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const token =
            parsed?.choices?.[0]?.delta?.content ||
            parsed?.response ||
            "";
          if (token) {
            fullReply += token;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
          }
        } catch {
          // Ignore malformed partial SSE frames
        }
      }
    },
    flush(controller) {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      if (typeof onComplete === "function" && fullReply.trim()) {
        onComplete(fullReply.trim(), modelUsed);
      }
    },
  });

  return {
    stream: aiStream.pipeThrough(transform),
    modelUsed,
  };
}

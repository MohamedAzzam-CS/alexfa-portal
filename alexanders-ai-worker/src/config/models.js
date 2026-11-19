export const MODELS = {
  // Step 1: Fast, ultra-cheap router & intent classifier
  ROUTER: "@cf/zai-org/glm-4.7-flash",

  // Step 2: Primary grounded QA & advisory responder
  RESPONDER: "@cf/qwen/qwen3.8-27b",

  // Automatic fallback if primary responder errors out
  FALLBACK: "@cf/google/gemma-4-26b-a4b-it",
};

export const GENERATION_CONFIG = {
  ROUTER: {
    temperature: 0.0,
    max_tokens: 180,
  },
  KB_FACT: {
    temperature: 0.2,
    max_tokens: 600,
  },
  ADVISOR: {
    temperature: 0.6,
    max_tokens: 900,
  },
};

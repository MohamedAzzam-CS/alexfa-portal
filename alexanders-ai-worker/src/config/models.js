export const MODELS = {
  EMBEDDING: "@cf/baai/bge-m3",
  FAST_FACT: "@cf/meta/llama-4-scout-17b-16e-instruct",
  ADVISOR: "@cf/qwen/qwen3.8-27b",
  FALLBACK: "@cf/google/gemma-4-26b-a4b-it",
};

export const GENERATION_CONFIG = {
  KB_FACT: {
    temperature: 0.1,
    max_tokens: 450,
  },
  ADVISOR: {
    temperature: 0.4,
    max_tokens: 350,
  },
};

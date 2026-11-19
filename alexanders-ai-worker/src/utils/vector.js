import { MODELS } from "../config/models.js";

export function toUnitFloat32(arr) {
  const vec = arr instanceof Float32Array ? arr : new Float32Array(arr);
  let normSq = 0;
  for (let i = 0; i < vec.length; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export async function embedTexts(env, texts) {
  const input = Array.isArray(texts) ? texts : [texts];
  if (input.length === 0) return [];

  const res = await env.AI.run(MODELS.EMBEDDING, { text: input });
  const vectors = res?.data;

  if (!Array.isArray(vectors) || vectors.length !== input.length) {
    throw new Error("Embedding model returned unexpected payload.");
  }

  return vectors.map((v) => toUnitFloat32(v));
}

export async function embedText(env, text) {
  const [vec] = await embedTexts(env, [text]);
  return vec;
}

import { queryMentionsColor } from "@/lib/retrieve/cues";

const VISUAL_CUE =
  /\b(icon|logo|image|picture|photo|drawing|artwork|illustration|graphic|symbol|emblem|mascot|visual|appearance|looks? like|looks? similar|depicts?)\b/i;

export function queryNeedsIconEmbedding(query: string): boolean {
  return VISUAL_CUE.test(query) || queryMentionsColor(query);
}

type CachedVector = {
  expiresAt: number;
  value: Promise<Float32Array | null>;
};

export function createEmbeddingCache(
  maxEntries = 128,
  ttlMs = 60 * 60 * 1000,
  now = Date.now,
) {
  const entries = new Map<string, CachedVector>();

  return (key: string, calculate: () => Promise<Float32Array | null>) => {
    const cached = entries.get(key);

    if (cached && cached.expiresAt > now()) {
      return cached.value;
    }

    entries.delete(key);

    const forget = () => {
      if (entries.get(key)?.value === value) entries.delete(key);
    };

    const value = calculate().then(
      (vector) => {
        if (!vector) forget();
        return vector;
      },
      (error) => {
        forget();
        throw error;
      },
    );

    entries.set(key, { expiresAt: now() + ttlMs, value });

    if (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value!);
    }

    return value;
  };
}

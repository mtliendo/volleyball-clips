import {
  GEMINI_AI_TAG_MODEL,
  aiTagRecordFromResult,
  mapAiTagsToCatalog,
  parseAiTagResult,
  type AiTagResult,
  type ClipAiTagRecord,
} from "./ai-tags";

export type GeminiFileRef = {
  name: string;
  uri: string;
};

export type GeminiTagClient = {
  uploadVideo: (bytes: Uint8Array, fileName: string) => Promise<GeminiFileRef>;
  generateFromFile: (file: GeminiFileRef) => Promise<unknown>;
  deleteFile: (name: string) => Promise<void>;
};

export type CatalogTag = { id: string; slug: string };

export async function tagClipPlayback(input: {
  clipId: string;
  videoBytes: Uint8Array;
  fileName?: string;
  catalog: CatalogTag[];
  tagsLocked: boolean;
  model?: string;
  gemini: GeminiTagClient;
  save: (record: ClipAiTagRecord) => Promise<void>;
  replaceCatalogTags?: (tagIds: string[]) => Promise<void>;
}): Promise<{ record: ClipAiTagRecord; appliedTagSlugs: string[] | null }> {
  const model = input.model ?? GEMINI_AI_TAG_MODEL;
  const fileName = input.fileName ?? `${input.clipId}.mp4`;
  let uploaded: GeminiFileRef | null = null;

  try {
    uploaded = await input.gemini.uploadVideo(input.videoBytes, fileName);
    const raw = await input.gemini.generateFromFile(uploaded);
    const result = parseAiTagResult(raw);
    const mappedTagSlugs = mapAiTagsToCatalog(
      result,
      input.catalog.map((tag) => tag.slug),
    );
    const record = aiTagRecordFromResult({
      clipId: input.clipId,
      result,
      mappedTagSlugs,
      model,
    });
    await input.save(record);

    if (!input.tagsLocked && input.replaceCatalogTags) {
      const bySlug = new Map(input.catalog.map((tag) => [tag.slug, tag.id]));
      const tagIds = mappedTagSlugs
        .map((slug) => bySlug.get(slug))
        .filter((id): id is string => Boolean(id));
      await input.replaceCatalogTags(tagIds);
      return { record, appliedTagSlugs: mappedTagSlugs };
    }

    return { record, appliedTagSlugs: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI tagging failed";
    await input.save({
      clipId: input.clipId,
      status: "failed",
      summary: null,
      actions: null,
      rallyCount: null,
      longestRallyS: null,
      highlightScore: null,
      tags: null,
      mappedTagSlugs: null,
      model,
      error: message,
      taggedAt: new Date(),
    });
    throw error;
  } finally {
    if (uploaded) {
      try {
        await input.gemini.deleteFile(uploaded.name);
      } catch (error) {
        console.error("Failed to delete Gemini file", uploaded.name, error);
      }
    }
  }
}

export function mockGeminiResult(overrides: Partial<AiTagResult> = {}): AiTagResult {
  return {
    summary: "The POV player serves and a teammate finishes the rally with a spike.",
    actions: [
      { type: "serve", start_s: 1.2, who: "POV player", outcome: "in play" },
      { type: "pass", start_s: 3.1, who: "opponent", outcome: "kept in play" },
      { type: "set", start_s: 4.4, who: "unknown", outcome: "settable" },
      { type: "attack/kill", start_s: 5.8, who: "teammate", outcome: "kill" },
    ],
    rally_count: 1,
    longest_rally_s: 8.2,
    highlight_score: 3,
    tags: ["serve", "spike", "kill"],
    ...overrides,
  };
}

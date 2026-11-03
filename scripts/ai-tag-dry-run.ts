import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { config } from "dotenv";
import {
  mockGeminiResult,
  tagClipPlayback,
  type GeminiTagClient,
} from "../src/lib/ai-tag-pipeline";
import { GEMINI_AI_TAG_MODEL } from "../src/lib/ai-tags";
import { createGeminiTagClient } from "../src/lib/gemini-files";
import { SEED_TAGS } from "../src/lib/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  const filePath = argValue("--file");
  const locked = process.argv.includes("--locked");
  const live = process.argv.includes("--live");
  if (!filePath) {
    throw new Error("Usage: pnpm ai-tags:dry-run -- --file path/to/playback.mp4 [--locked] [--live]");
  }

  const videoBytes = await readFile(filePath);
  const catalog = SEED_TAGS.map((tag, index) => ({ id: String(index + 1), slug: tag.slug }));
  const saved: unknown[] = [];
  const applied: string[][] = [];

  const gemini: GeminiTagClient = live
    ? createGeminiTagClient({
        apiKey: process.env.GEMINI_API_KEY ?? "",
        model: process.env.GEMINI_MODEL ?? GEMINI_AI_TAG_MODEL,
      })
    : {
        async uploadVideo() {
          return { name: "files/dry-run", uri: "https://example.invalid/files/dry-run" };
        },
        async generateFromFile() {
          return mockGeminiResult();
        },
        async deleteFile() {},
      };

  if (live && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for --live");
  }

  const { record, appliedTagSlugs } = await tagClipPlayback({
    clipId: "00000000-0000-4000-8000-000000000000",
    videoBytes,
    fileName: basename(filePath),
    catalog,
    tagsLocked: locked,
    gemini,
    save: async (row) => {
      saved.push(row);
    },
    replaceCatalogTags: async (tagIds) => {
      applied.push(tagIds);
    },
  });

  console.log(
    JSON.stringify(
      {
        mock: !live,
        tagsLocked: locked,
        appliedTagSlugs,
        appliedTagIds: applied[0] ?? null,
        record,
        writes: saved.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

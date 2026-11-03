import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tagClipPlayback, mockGeminiResult, type GeminiTagClient } from "./ai-tag-pipeline";
import type { ClipAiTagRecord } from "./ai-tags";

const CATALOG = [
  { id: "1", slug: "spike" },
  { id: "2", slug: "serve" },
  { id: "3", slug: "set" },
  { id: "4", slug: "rally" },
];

function mockGemini(result = mockGeminiResult()): GeminiTagClient & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    async uploadVideo() {
      return { name: "files/sample", uri: "https://generativelanguage.googleapis.com/files/sample" };
    },
    async generateFromFile() {
      return result;
    },
    async deleteFile(name) {
      deleted.push(name);
    },
  };
}

describe("tagClipPlayback", () => {
  it("tags a sample playback path, writes the AI row, maps catalog tags, and deletes the Gemini file", async () => {
    const gemini = mockGemini();
    const saved: ClipAiTagRecord[] = [];
    const applied: string[][] = [];

    const { record, appliedTagSlugs } = await tagClipPlayback({
      clipId: "11111111-1111-4111-8111-111111111111",
      videoBytes: new Uint8Array([0, 1, 2, 3]),
      fileName: "playback/game/clip/playback.mp4",
      catalog: CATALOG,
      tagsLocked: false,
      gemini,
      save: async (row) => {
        saved.push(row);
      },
      replaceCatalogTags: async (tagIds) => {
        applied.push(tagIds);
      },
    });

    assert.equal(record.status, "done");
    assert.equal(record.summary?.includes("spike"), true);
    assert.deepEqual(appliedTagSlugs?.slice().sort(), ["serve", "spike"]);
    assert.deepEqual(applied[0]?.slice().sort(), ["1", "2"]);
    assert.deepEqual(gemini.deleted, ["files/sample"]);
    assert.equal(saved.at(-1)?.status, "done");
  });

  it("replaces existing unlocked catalog tags instead of merging", async () => {
    const gemini = mockGemini();
    const clipId = "11111111-1111-4111-8111-111111111111";
    const tagsByClip = new Map<string, string[]>([[clipId, ["funny", "block"]]]);

    const { appliedTagSlugs } = await tagClipPlayback({
      clipId,
      videoBytes: new Uint8Array([0, 1, 2, 3]),
      catalog: CATALOG,
      tagsLocked: false,
      gemini,
      save: async () => {},
      replaceCatalogTags: async (tagIds) => {
        tagsByClip.set(clipId, tagIds);
      },
    });

    assert.deepEqual(appliedTagSlugs?.slice().sort(), ["serve", "spike"]);
    assert.deepEqual(tagsByClip.get(clipId)?.slice().sort(), ["1", "2"]);
    assert.equal(tagsByClip.get(clipId)?.includes("funny"), false);
    assert.equal(tagsByClip.get(clipId)?.includes("block"), false);
  });

  it("does not overwrite catalog tags when the admin has locked them", async () => {
    const gemini = mockGemini();
    let replaced = false;

    const { appliedTagSlugs } = await tagClipPlayback({
      clipId: "11111111-1111-4111-8111-111111111111",
      videoBytes: new Uint8Array([0, 1, 2, 3]),
      catalog: CATALOG,
      tagsLocked: true,
      gemini,
      save: async () => {},
      replaceCatalogTags: async () => {
        replaced = true;
      },
    });

    assert.equal(appliedTagSlugs, null);
    assert.equal(replaced, false);
    assert.deepEqual(gemini.deleted, ["files/sample"]);
  });

  it("saves a failed row, still deletes the Gemini file, and rethrows", async () => {
    const deleted: string[] = [];
    const saved: ClipAiTagRecord[] = [];
    const gemini: GeminiTagClient = {
      async uploadVideo() {
        return { name: "files/broken", uri: "https://example/files/broken" };
      },
      async generateFromFile() {
        throw new Error("429 from Gemini");
      },
      async deleteFile(name) {
        deleted.push(name);
      },
    };

    await assert.rejects(
      () =>
        tagClipPlayback({
          clipId: "11111111-1111-4111-8111-111111111111",
          videoBytes: new Uint8Array([9]),
          catalog: CATALOG,
          tagsLocked: false,
          gemini,
          save: async (row) => {
            saved.push(row);
          },
        }),
      /429 from Gemini/,
    );

    assert.equal(saved[0]?.status, "failed");
    assert.equal(saved[0]?.error, "429 from Gemini");
    assert.deepEqual(deleted, ["files/broken"]);
  });
});

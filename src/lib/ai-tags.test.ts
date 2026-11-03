import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalizeAiTag,
  mapAiTagsToCatalog,
  parseAiTagResult,
} from "./ai-tags";

const CATALOG = [
  "ace",
  "serve",
  "dig",
  "set",
  "spike",
  "block",
  "rally",
  "save",
  "funny",
];

describe("canonicalizeAiTag", () => {
  it("maps kill and attack/kill to spike", () => {
    assert.equal(canonicalizeAiTag("kill"), "spike");
    assert.equal(canonicalizeAiTag("attack/kill"), "spike");
    assert.equal(canonicalizeAiTag("Spike"), "spike");
  });

  it("maps long rally and collision to catalog slugs", () => {
    assert.equal(canonicalizeAiTag("long rally"), "rally");
    assert.equal(canonicalizeAiTag("collision"), "funny");
  });
});

describe("mapAiTagsToCatalog", () => {
  it("keeps site vocabulary and drops filler tags", () => {
    const mapped = mapAiTagsToCatalog(
      {
        tags: ["spike", "kill", "volleyball", "pov", "indoor", "funny"],
        actions: [],
        longest_rally_s: 4,
      },
      CATALOG,
    );
    assert.deepEqual(mapped.sort(), ["funny", "spike"]);
  });

  it("adds distinctive action types and long rallies", () => {
    const mapped = mapAiTagsToCatalog(
      {
        tags: ["serve"],
        actions: [
          { type: "serve", start_s: 1, who: "POV player", outcome: "in play" },
          { type: "attack/kill", start_s: 6, who: "teammate", outcome: "kill" },
          { type: "block", start_s: 12, who: "unknown", outcome: "stuff" },
        ],
        longest_rally_s: 14,
      },
      CATALOG,
    );
    assert.deepEqual(mapped.sort(), ["block", "rally", "serve", "spike"]);
  });

  it("does not invent catalog slugs that are not on the site", () => {
    const mapped = mapAiTagsToCatalog(
      {
        tags: ["collision", "celebration"],
        actions: [],
        longest_rally_s: 3,
      },
      ["spike", "set"],
    );
    assert.deepEqual(mapped, []);
  });
});

describe("parseAiTagResult", () => {
  it("accepts a valid Gemini payload", () => {
    const result = parseAiTagResult({
      summary: "A short rally ends on a teammate kill.",
      actions: [
        { type: "serve", start_s: 0.4, who: "unknown", outcome: "in play" },
        { type: "attack/kill", start_s: 5, who: "teammate", outcome: "kill" },
      ],
      rally_count: 1,
      longest_rally_s: 7.5,
      highlight_score: 4,
      tags: ["spike", "rally"],
    });
    assert.equal(result.rally_count, 1);
    assert.equal(result.actions[1]?.type, "attack/kill");
  });

  it("rejects a kill-looking score outside 1-5", () => {
    assert.throws(() =>
      parseAiTagResult({
        summary: "Nope",
        actions: [],
        rally_count: 1,
        longest_rally_s: 2,
        highlight_score: 9,
        tags: [],
      }),
    );
  });
});

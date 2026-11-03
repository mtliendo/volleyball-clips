import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { replaceClipCatalogTags } from "./clip-catalog-tags";

describe("replaceClipCatalogTags", () => {
  it("deletes existing rows for the clip, then inserts only the mapped set", async () => {
    const rows = new Map<string, Set<string>>([
      ["clip-a", new Set(["funny", "block"])],
      ["clip-b", new Set(["dig"])],
    ]);
    const statements: string[] = [];

    await replaceClipCatalogTags(
      async (sql, params) => {
        statements.push(sql.split(" ")[0] ?? "");
        const clipId = String(params[0]);
        if (sql.startsWith("DELETE")) {
          rows.set(clipId, new Set());
          return;
        }
        const tagId = String(params[1]);
        const current = rows.get(clipId) ?? new Set();
        current.add(tagId);
        rows.set(clipId, current);
      },
      "clip-a",
      ["serve", "spike"],
    );

    assert.deepEqual(statements, ["DELETE", "INSERT", "INSERT"]);
    assert.deepEqual([...rows.get("clip-a") ?? []].sort(), ["serve", "spike"]);
    assert.deepEqual([...rows.get("clip-b") ?? []], ["dig"]);
  });

  it("clears previous tags when the mapped set is empty", async () => {
    const rows = new Map<string, Set<string>>([["clip-a", new Set(["funny"])]]);

    await replaceClipCatalogTags(
      async (sql, params) => {
        const clipId = String(params[0]);
        if (sql.startsWith("DELETE")) {
          rows.set(clipId, new Set());
        }
      },
      "clip-a",
      [],
    );

    assert.deepEqual([...(rows.get("clip-a") ?? [])], []);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deleteAdminClip, type AdminClipDeleteDeps, type ClipMediaRecord } from "./admin-clip-delete";

const CLIP_ID = "22222222-2222-4222-8222-222222222221";
const clip: ClipMediaRecord = {
  id: CLIP_ID,
  gameId: "11111111-1111-4111-8111-111111111111",
  originalKey: `uploads/game/${CLIP_ID}/original.mp4`,
  playbackKey: `playback/game/${CLIP_ID}/playback.mp4`,
  posterKey: `posters/game/${CLIP_ID}/poster.jpg`,
};

function deps(overrides: Partial<AdminClipDeleteDeps> = {}): AdminClipDeleteDeps & {
  deletedRows: string[];
  deletedObjects: ClipMediaRecord[][];
  revalidated: { gameId: string; clipId: string }[];
} {
  const deletedRows: string[] = [];
  const deletedObjects: ClipMediaRecord[][] = [];
  const revalidated: { gameId: string; clipId: string }[] = [];
  return {
    deletedRows,
    deletedObjects,
    revalidated,
    async authorize() {
      return { ok: true };
    },
    isDatabaseConfigured: () => true,
    isS3Configured: () => true,
    isUuid: (id) => id === CLIP_ID,
    async findClip(id) {
      return id === CLIP_ID ? clip : null;
    },
    async deleteClipObjects(rows) {
      deletedObjects.push(rows);
      return { failed: [] };
    },
    async deleteRows(id) {
      deletedRows.push(id);
    },
    revalidate(input) {
      revalidated.push(input);
    },
    ...overrides,
  };
}

describe("deleteAdminClip", () => {
  it("rejects signed-out and non-admin callers without touching storage", async () => {
    const unauthorized = deps({
      async authorize() {
        return { ok: false, status: 401, error: "Unauthorized" };
      },
    });
    const unauthResult = await deleteAdminClip(CLIP_ID, unauthorized);
    assert.equal(unauthResult.status, 401);
    assert.deepEqual(unauthResult.body, { error: "Unauthorized" });
    assert.deepEqual(unauthorized.deletedObjects, []);
    assert.deepEqual(unauthorized.deletedRows, []);

    const forbidden = deps({
      async authorize() {
        return { ok: false, status: 403, error: "Forbidden" };
      },
    });
    const forbidResult = await deleteAdminClip(CLIP_ID, forbidden);
    assert.equal(forbidResult.status, 403);
    assert.deepEqual(forbidResult.body, { error: "Forbidden" });
    assert.deepEqual(forbidden.deletedObjects, []);
    assert.deepEqual(forbidden.deletedRows, []);
  });

  it("leaves database rows in place when object cleanup fails", async () => {
    const failed = deps({
      async deleteClipObjects() {
        return {
          failed: [{ key: clip.originalKey, message: "AccessDenied" }],
        };
      },
    });
    const result = await deleteAdminClip(CLIP_ID, failed);
    assert.equal(result.status, 502);
    assert.match(String(result.body.error), /Database rows were left unchanged/);
    assert.deepEqual(failed.deletedRows, []);
    assert.deepEqual(failed.revalidated, []);
  });

  it("removes objects then rows and revalidates on success", async () => {
    const ok = deps();
    const result = await deleteAdminClip(CLIP_ID, ok);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true });
    assert.equal(ok.deletedObjects.length, 1);
    assert.equal(ok.deletedObjects[0][0]?.id, CLIP_ID);
    assert.deepEqual(ok.deletedRows, [CLIP_ID]);
    assert.deepEqual(ok.revalidated, [{ gameId: clip.gameId, clipId: CLIP_ID }]);
  });
});

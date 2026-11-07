import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_CLIP_DELETE_METHOD,
  adminClipDeletePath,
  clipDeleteErrorMessage,
  clipDeleteIdentity,
  removeClipAndSelectNext,
  requestAdminClipDelete,
} from "./clip-delete";

const clips = [
  { id: "clip-a" },
  { id: "clip-b" },
  { id: "clip-c" },
];

describe("adminClipDeletePath", () => {
  it("targets the existing admin clip route", () => {
    assert.equal(
      adminClipDeletePath("22222222-2222-4222-8222-222222222221"),
      "/api/admin/clips/22222222-2222-4222-8222-222222222221",
    );
    assert.equal(ADMIN_CLIP_DELETE_METHOD, "DELETE");
  });
});

describe("removeClipAndSelectNext", () => {
  it("moves to the next clip after a middle or first delete", () => {
    const first = removeClipAndSelectNext(clips, "clip-a");
    assert.deepEqual(
      first.clips.map((clip) => clip.id),
      ["clip-b", "clip-c"],
    );
    assert.equal(first.next?.id, "clip-b");
    assert.equal(first.nextIndex, 0);

    const middle = removeClipAndSelectNext(clips, "clip-b");
    assert.equal(middle.next?.id, "clip-c");
    assert.equal(middle.nextIndex, 1);
  });

  it("moves to the previous clip when the last one is deleted", () => {
    const last = removeClipAndSelectNext(clips, "clip-c");
    assert.equal(last.next?.id, "clip-b");
    assert.equal(last.nextIndex, 1);
  });

  it("returns an empty fallback when the only clip is deleted", () => {
    const empty = removeClipAndSelectNext([{ id: "clip-a" }], "clip-a");
    assert.deepEqual(empty.clips, []);
    assert.equal(empty.next, null);
    assert.equal(empty.nextIndex, -1);
  });
});

describe("clipDeleteIdentity", () => {
  it("names the clip from tags, duration, and pin", () => {
    const identity = clipDeleteIdentity({
      tags: [{ name: "Spike" }],
      durationLabel: "0:08",
      pin: { label: "super_spike" },
    });
    assert.equal(identity.tags, "Spike");
    assert.equal(identity.details, "Spike · 0:08 · super spike");
  });

  it("falls back to untagged when there are no names", () => {
    const identity = clipDeleteIdentity({ tags: [] });
    assert.equal(identity.tags, "Untagged");
    assert.equal(identity.details, "Untagged");
  });
});

describe("requestAdminClipDelete", () => {
  it("returns ok on a successful authorized delete", async () => {
    const result = await requestAdminClipDelete("clip-a", async (input, init) => {
      assert.equal(String(input), "/api/admin/clips/clip-a");
      assert.equal(init?.method, "DELETE");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    assert.deepEqual(result, { ok: true });
  });

  it("surfaces a failed delete so the viewer can retry", async () => {
    const result = await requestAdminClipDelete("clip-a", async () => {
      return new Response(JSON.stringify({ error: "Could not delete all S3 objects. Database rows were left unchanged." }), {
        status: 502,
      });
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected failure");
    assert.equal(result.status, 502);
    assert.match(result.error, /Database rows were left unchanged/);
  });

  it("rejects unauthorized and forbidden callers", async () => {
    const unauthorized = await requestAdminClipDelete("clip-a", async () => {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    });
    assert.equal(unauthorized.ok, false);
    if (unauthorized.ok) throw new Error("expected 401");
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.error, "Unauthorized");

    const forbidden = await requestAdminClipDelete("clip-a", async () => {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    });
    assert.equal(forbidden.ok, false);
    if (forbidden.ok) throw new Error("expected 403");
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.error, "Forbidden");
  });
});

describe("clipDeleteErrorMessage", () => {
  it("keeps a server error string and falls back otherwise", () => {
    assert.equal(clipDeleteErrorMessage({ error: "Forbidden" }), "Forbidden");
    assert.equal(clipDeleteErrorMessage({}), "Could not delete clip");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contentDispositionAttachment,
  downloadFilename,
  filenameFromContentDisposition,
  sanitizeDownloadFilename,
} from "./download";

const clipId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("sanitizeDownloadFilename", () => {
  it("keeps the existing character sanitization", () => {
    assert.equal(sanitizeDownloadFilename("my clip (1).mov"), "my-clip-1-.mov");
  });

  it("does not append .mp4 onto a different extension", () => {
    assert.equal(sanitizeDownloadFilename("IMG_1234.mov"), "IMG_1234.mov");
    assert.equal(sanitizeDownloadFilename("IMG_1234.MOV"), "IMG_1234.MOV");
  });

  it("falls back when the name is empty or only punctuation", () => {
    assert.equal(sanitizeDownloadFilename("   "), "clip");
    assert.equal(sanitizeDownloadFilename("***"), "-");
  });
});

describe("downloadFilename", () => {
  it("uses the original stem with .mp4 for the 1080p copy", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/IMG_1234.mov",
        quality: "playback",
      }),
      "IMG_1234.mp4",
    );
  });

  it("keeps the real original extension, including .mov", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/IMG_1234.mov",
        quality: "original",
      }),
      "IMG_1234.mov",
    );
  });

  it("does not produce a double extension", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "IMG_1234.mov",
        quality: "playback",
      }),
      "IMG_1234.mp4",
    );
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "IMG_1234.mov",
        quality: "original",
      }),
      "IMG_1234.mov",
    );
  });

  it("handles uppercase extensions", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/IMG_1234.MOV",
        quality: "original",
      }),
      "IMG_1234.MOV",
    );
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/IMG_1234.MOV",
        quality: "playback",
      }),
      "IMG_1234.mp4",
    );
  });

  it("handles multiple dots", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/my.clip.v2.mov",
        quality: "playback",
      }),
      "my.clip.v2.mp4",
    );
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/my.clip.v2.mov",
        quality: "original",
      }),
      "my.clip.v2.mov",
    );
  });

  it("handles names with no extension", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/clipname",
        quality: "playback",
      }),
      "clipname.mp4",
    );
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/clipname",
        quality: "original",
      }),
      "clipname",
    );
  });

  it("keeps sanitization for weird characters", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/my clip (1).mov",
        quality: "playback",
      }),
      "my-clip-1-.mp4",
    );
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/my clip (1).mov",
        quality: "original",
      }),
      "my-clip-1-.mov",
    );
  });

  it("uses the clip id when the key has no filename", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/",
        quality: "playback",
      }),
      "aaaaaaaa.mp4",
    );
  });

  it("leaves an already-mp4 original name alone", () => {
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/rally.mp4",
        quality: "original",
      }),
      "rally.mp4",
    );
    assert.equal(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/rally.mp4",
        quality: "playback",
      }),
      "rally.mp4",
    );
  });
});

describe("contentDispositionAttachment", () => {
  it("does not rewrite a .mov original into .mov.mp4", () => {
    const header = contentDispositionAttachment(
      downloadFilename({
        id: clipId,
        originalKey: "uploads/game/clip/IMG_1234.mov",
        quality: "original",
      }),
    );
    assert.match(header, /filename="IMG_1234\.mov"/);
    assert.equal(header.includes(".mov.mp4"), false);
    assert.equal(filenameFromContentDisposition(header), "IMG_1234.mov");
  });

  it("round-trips a 1080p mp4 name", () => {
    const filename = downloadFilename({
      id: clipId,
      originalKey: "uploads/game/clip/my.clip.v2.mov",
      quality: "playback",
    });
    const header = contentDispositionAttachment(filename);
    assert.equal(filenameFromContentDisposition(header), "my.clip.v2.mp4");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeDownloadFilename } from "./download";
import {
  canShareFiles,
  createShareFile,
  downloadShareFilename,
  downloadShareMimeType,
  isIOSLike,
  isShareAbortError,
  preparingDownloadLabel,
  progressPercent,
  readResponseBlob,
  shouldUsePhotosShare,
} from "./save-to-photos";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPADOS_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function shareFilesOk() {
  return (data?: ShareData) => Boolean(data?.files && data.files.length > 0);
}

function shareFilesNo() {
  return () => false;
}

describe("isIOSLike", () => {
  it("detects iPhone and iPod", () => {
    assert.equal(isIOSLike({ userAgent: IPHONE_UA }), true);
    assert.equal(
      isIOSLike({
        userAgent:
          "Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      }),
      true,
    );
  });

  it("detects classic iPad UA", () => {
    assert.equal(isIOSLike({ userAgent: IPAD_UA }), true);
  });

  it("detects iPadOS desktop UA when the device has touch", () => {
    assert.equal(
      isIOSLike({
        userAgent: IPADOS_DESKTOP_UA,
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
      true,
    );
  });

  it("does not treat a desktop Mac as iPadOS", () => {
    assert.equal(
      isIOSLike({
        userAgent: DESKTOP_CHROME_UA,
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
      false,
    );
    assert.equal(
      isIOSLike({
        userAgent: IPADOS_DESKTOP_UA,
        platform: "MacIntel",
        maxTouchPoints: 1,
      }),
      false,
    );
  });

  it("does not treat Android as iOS", () => {
    assert.equal(isIOSLike({ userAgent: ANDROID_UA, maxTouchPoints: 5 }), false);
  });
});

describe("canShareFiles", () => {
  it("requires canShare and a files payload that the browser accepts", () => {
    assert.equal(canShareFiles(undefined), false);
    assert.equal(canShareFiles(shareFilesNo()), false);
    assert.equal(canShareFiles(shareFilesOk()), true);
  });

  it("treats canShare throwing as unsupported", () => {
    assert.equal(
      canShareFiles(() => {
        throw new Error("not supported");
      }),
      false,
    );
  });
});

describe("shouldUsePhotosShare", () => {
  it("uses the share sheet only on iOS/iPadOS that can share files", () => {
    assert.equal(
      shouldUsePhotosShare({
        userAgent: IPHONE_UA,
        canShare: shareFilesOk(),
      }),
      true,
    );
    assert.equal(
      shouldUsePhotosShare({
        userAgent: IPAD_UA,
        canShare: shareFilesOk(),
      }),
      true,
    );
    assert.equal(
      shouldUsePhotosShare({
        userAgent: IPADOS_DESKTOP_UA,
        platform: "MacIntel",
        maxTouchPoints: 5,
        canShare: shareFilesOk(),
      }),
      true,
    );
  });

  it("falls back to a normal download on iOS without file sharing", () => {
    assert.equal(
      shouldUsePhotosShare({
        userAgent: IPHONE_UA,
        canShare: shareFilesNo(),
      }),
      false,
    );
    assert.equal(shouldUsePhotosShare({ userAgent: IPHONE_UA }), false);
  });

  it("never uses the Photos share path on Android or desktop", () => {
    assert.equal(
      shouldUsePhotosShare({
        userAgent: ANDROID_UA,
        maxTouchPoints: 5,
        canShare: shareFilesOk(),
      }),
      false,
    );
    assert.equal(
      shouldUsePhotosShare({
        userAgent: DESKTOP_CHROME_UA,
        platform: "MacIntel",
        maxTouchPoints: 0,
        canShare: shareFilesOk(),
      }),
      false,
    );
  });
});

describe("downloadShareMimeType", () => {
  it("uses video/quicktime for originals with a .mov name", () => {
    assert.equal(downloadShareMimeType("IMG_1234.mov", "video/mp4"), "video/quicktime");
    assert.equal(downloadShareMimeType("IMG_1234.MOV", "application/octet-stream"), "video/quicktime");
  });

  it("keeps the original mime when it is a real video type", () => {
    assert.equal(downloadShareMimeType("rally.mp4", "video/mp4"), "video/mp4");
    assert.equal(downloadShareMimeType("rally.m4v", "video/x-m4v"), "video/x-m4v");
  });

  it("defaults to video/mp4 when the header is missing or generic", () => {
    assert.equal(downloadShareMimeType("rally.mp4"), "video/mp4");
    assert.equal(downloadShareMimeType("rally.mp4", "application/octet-stream"), "video/mp4");
  });
});

describe("downloadShareFilename", () => {
  it("uses sanitizeDownloadFilename so share names match downloads", () => {
    assert.equal(downloadShareFilename("my clip (1).mov"), sanitizeDownloadFilename("my clip (1).mov"));
    assert.equal(downloadShareFilename("IMG_1234.MOV"), "IMG_1234.MOV");
  });
});

describe("createShareFile", () => {
  it("builds a File with the sanitized name and .mov mime", () => {
    const file = createShareFile(new Blob(["clip"], { type: "video/mp4" }), "IMG_1234.mov", "video/mp4");
    assert.equal(file.name, "IMG_1234.mov");
    assert.equal(file.type, "video/quicktime");
  });
});

describe("isShareAbortError", () => {
  it("recognizes a cancelled share sheet", () => {
    assert.equal(isShareAbortError(new DOMException("cancelled", "AbortError")), true);
    assert.equal(isShareAbortError(Object.assign(new Error("cancelled"), { name: "AbortError" })), true);
    assert.equal(isShareAbortError(new Error("share failed")), false);
  });
});

describe("progress helpers", () => {
  it("returns a percent only when the total is known", () => {
    assert.equal(progressPercent(50, 100), 50);
    assert.equal(progressPercent(1, 3), 33);
    assert.equal(progressPercent(10, null), null);
    assert.equal(progressPercent(10, 0), null);
  });

  it("keeps the existing pending copy when there is no percent", () => {
    assert.equal(preparingDownloadLabel(null), "Preparing download...");
    assert.equal(preparingDownloadLabel(42), "Preparing 42%...");
  });
});

describe("readResponseBlob", () => {
  it("streams a body and reports content-length progress", async () => {
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])];
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(chunks[offset]);
        offset += 1;
      },
    });
    const reports: Array<{ loaded: number; total: number | null }> = [];
    const blob = await readResponseBlob(
      new Response(stream, {
        headers: {
          "content-type": "video/mp4",
          "content-length": "5",
        },
      }),
      (loaded, total) => reports.push({ loaded, total }),
    );

    assert.equal(blob.size, 5);
    assert.equal(blob.type, "video/mp4");
    assert.deepEqual(reports, [
      { loaded: 2, total: 5 },
      { loaded: 5, total: 5 },
    ]);
  });
});

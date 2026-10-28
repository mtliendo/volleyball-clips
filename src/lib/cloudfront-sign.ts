import "server-only";

import { getSignedCookies, getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { cdnUrl } from "./cdn";

/** Short TTL so a leaked signed URL is useless. Phase 2 can reuse this. */
export const SIGNED_URL_TTL_SECONDS = 5 * 60;

export function readCloudFrontPrivateKey() {
  const raw = process.env.CLOUDFRONT_PRIVATE_KEY?.trim();
  if (!raw) return null;

  if (raw.includes("BEGIN")) {
    return raw.replace(/\\n/g, "\n");
  }

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.includes("BEGIN")) {
      return decoded;
    }
  } catch {
    /* not base64 */
  }

  return raw.replace(/\\n/g, "\n");
}

export function isCloudFrontSigningConfigured() {
  return Boolean(
    process.env.CLOUDFRONT_KEY_PAIR_ID?.trim() && readCloudFrontPrivateKey(),
  );
}

/**
 * Sign any CDN object URL with the trusted key group.
 * Phase 1 uses this for `uploads/*`. Phase 2 can pass `playback/*` (or cookies).
 */
export function signCdnUrl(
  key: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS,
) {
  const url = cdnUrl(key);
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID?.trim();
  const privateKey = readCloudFrontPrivateKey();
  if (!url || !keyPairId || !privateKey) {
    throw new Error("CloudFront signing is not configured");
  }

  return getSignedUrl({
    url,
    keyPairId,
    privateKey,
    dateLessThan: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  });
}

/** Phase 2 can attach these cookies to `playback/*` once that behavior requires signing. */
export function signCdnCookies(
  resourceUrl: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS,
) {
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID?.trim();
  const privateKey = readCloudFrontPrivateKey();
  if (!keyPairId || !privateKey) {
    throw new Error("CloudFront signing is not configured");
  }

  return getSignedCookies({
    url: resourceUrl,
    keyPairId,
    privateKey,
    dateLessThan: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  });
}

/**
 * URL the server uses to fetch an original. Signs when keys are set;
 * otherwise returns the public CDN URL so the app can ship before the CDK lock.
 */
export function originalObjectUrl(key: string) {
  if (isCloudFrontSigningConfigured()) {
    return signCdnUrl(key);
  }
  return cdnUrl(key);
}

/**
 * URL the server uses to fetch a playback copy. Phase 1 leaves these unsigned.
 * Phase 2 should switch this to `signCdnUrl(key)` (or signed cookies).
 */
export function playbackObjectUrl(key: string) {
  return cdnUrl(key);
}

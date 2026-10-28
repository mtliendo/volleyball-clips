import "server-only";

import { getSignedCookies, getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { cdnUrl } from "./cdn";
import { SIGNED_PLAYBACK_TTL_SECONDS } from "./playback";

/** Short TTL so a leaked signed download URL is useless. */
export const SIGNED_URL_TTL_SECONDS = 5 * 60;

export { SIGNED_PLAYBACK_TTL_SECONDS };

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
 * Sign any CDN object URL with the trusted key group (uploads + playback).
 * Per-clip signed URLs are used for playback because the CDN host is
 * cross-origin (`*.cloudfront.net`); the app cannot set CloudFront cookies.
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

/** Cookie signer for a future `cdn.vbpov.com` host. Unused while the CDN is `*.cloudfront.net`. */
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
 * URL the server uses to fetch a playback copy (download proxy).
 * Falls back to a public CDN URL when signing is not configured.
 */
export function playbackObjectUrl(key: string) {
  if (isCloudFrontSigningConfigured()) {
    return signCdnUrl(key, SIGNED_URL_TTL_SECONDS);
  }
  return cdnUrl(key);
}

/**
 * Browser feed URL. Longer TTL than downloads so a session does not stall;
 * the feed refreshes the grant before expiry.
 */
export function playbackWatchUrl(key: string) {
  if (isCloudFrontSigningConfigured()) {
    return signCdnUrl(key, SIGNED_PLAYBACK_TTL_SECONDS);
  }
  return cdnUrl(key);
}

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Chicago";

export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
export const PRESIGN_EXPIRES_SECONDS = 15 * 60;

export const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/webm",
  "video/3gpp",
  "video/3gpp2",
  "video/x-matroska",
  "video/hevc",
  "video/h265",
  "video/mp2t",
]);

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function isAuth0Configured() {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_SECRET &&
      process.env.APP_BASE_URL,
  );
}

export function isS3Configured() {
  return Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION);
}

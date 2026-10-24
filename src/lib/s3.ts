import "server-only";

import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import {
  ALLOWED_VIDEO_TYPES,
  MAX_UPLOAD_BYTES,
  PRESIGN_EXPIRES_SECONDS,
} from "./env";

function createS3Client() {
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION is not set");
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return new S3Client({ region });
  }

  if (!process.env.AWS_ROLE_ARN) {
    throw new Error(
      "Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY for local uploads or AWS_ROLE_ARN for Vercel OIDC",
    );
  }

  return new S3Client({
    region,
    credentials: awsCredentialsProvider({
      roleArn: process.env.AWS_ROLE_ARN,
    }),
  });
}

export function getBucket() {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not set");
  }
  return bucket;
}

export function inferContentType(filename: string, contentType?: string) {
  if (contentType && ALLOWED_VIDEO_TYPES.has(contentType)) {
    return contentType;
  }

  const ext = filename.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    webm: "video/webm",
    mkv: "video/x-matroska",
    "3gp": "video/3gpp",
  };

  return ext ? byExt[ext] : undefined;
}

export function assertUploadAllowed(input: {
  filename: string;
  contentType?: string;
  size: number;
}) {
  if (input.size <= 0 || input.size > MAX_UPLOAD_BYTES) {
    throw new Error("Video must be between 1 byte and 1 GB");
  }

  const contentType = inferContentType(input.filename, input.contentType);
  if (!contentType || !ALLOWED_VIDEO_TYPES.has(contentType)) {
    throw new Error("Unsupported video type");
  }

  return contentType;
}

export function originalKey(gameId: string, clipId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "clip.mp4";
  return `uploads/${gameId}/${clipId}/${safe}`;
}

export function playbackKey(gameId: string, clipId: string) {
  return `playback/${gameId}/${clipId}/playback.mp4`;
}

export function posterKey(gameId: string, clipId: string) {
  return `posters/${gameId}/${clipId}/poster.jpg`;
}

export async function presignPut(input: {
  key: string;
  contentType: string;
  size: number;
}) {
  const client = createS3Client();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.size,
  });

  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SECONDS });
}

export type ClipMediaKeys = {
  id: string;
  gameId: string;
  originalKey: string;
  playbackKey?: string | null;
  posterKey?: string | null;
};

export function clipObjectKeys(clip: ClipMediaKeys) {
  const keys = new Set<string>();
  if (clip.originalKey) keys.add(clip.originalKey);
  keys.add(playbackKey(clip.gameId, clip.id));
  keys.add(posterKey(clip.gameId, clip.id));
  if (clip.playbackKey) keys.add(clip.playbackKey);
  if (clip.posterKey) keys.add(clip.posterKey);
  return [...keys];
}

const IGNORABLE_DELETE_CODES = new Set(["NoSuchKey", "NotFound"]);

export async function deleteObjects(keys: string[]) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) {
    return { deleted: [] as string[], failed: [] as { key: string; message: string }[] };
  }

  const client = createS3Client();
  const bucket = getBucket();
  const deleted: string[] = [];
  const failed: { key: string; message: string }[] = [];

  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: false,
        },
      }),
    );

    for (const obj of result.Deleted ?? []) {
      if (obj.Key) deleted.push(obj.Key);
    }

    for (const err of result.Errors ?? []) {
      if (err.Code && IGNORABLE_DELETE_CODES.has(err.Code)) {
        if (err.Key) deleted.push(err.Key);
        continue;
      }
      failed.push({
        key: err.Key ?? "",
        message: err.Message ?? err.Code ?? "Delete failed",
      });
    }
  }

  return { deleted, failed };
}

export async function deleteClipObjects(clipsToDelete: ClipMediaKeys[]) {
  return deleteObjects(clipsToDelete.flatMap(clipObjectKeys));
}

import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const execFileAsync = promisify(execFile);
const s3 = new S3Client({});
const ssm = new SSMClient({});
let cachedWebhookSecret;

function sign(body, secret) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function getWebhookSecret() {
  if (cachedWebhookSecret) {
    return cachedWebhookSecret;
  }

  const name = process.env.WEBHOOK_SECRET_PARAMETER;
  if (!name) {
    throw new Error("WEBHOOK_SECRET_PARAMETER is not set");
  }

  const result = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  );
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter ${name} has no value`);
  }

  cachedWebhookSecret = value;
  return cachedWebhookSecret;
}

async function postWebhook(payload) {
  const body = JSON.stringify(payload);
  const secret = await getWebhookSecret();
  const response = await fetch(process.env.WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": sign(body, secret),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Webhook failed ${response.status}: ${text}`);
  }
}

function parseUploadKey(key) {
  const parts = key.split("/");
  if (parts.length < 4 || parts[0] !== "uploads") {
    throw new Error(`Unexpected key ${key}`);
  }
  return { gameId: parts[1], clipId: parts[2] };
}

async function downloadObject(bucket, key, dest) {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(object.Body, createWriteStream(dest));
}

async function uploadFile(bucket, key, filePath, contentType) {
  const { createReadStream } = await import("node:fs");
  const fileStat = await stat(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      ContentLength: fileStat.size,
    }),
  );
}

async function probeDurationMs(inputPath) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nw=1:nk=1",
      inputPath,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds)) {
    return null;
  }
  return Math.round(seconds * 1000);
}

async function transcode(inputPath, outputPath) {
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "scale=1080:-2,fps=30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-b:v",
      "5M",
      "-maxrate",
      "5M",
      "-bufsize",
      "10M",
      "-profile:v",
      "high",
      "-level",
      "4.1",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",
      outputPath,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
}

async function makePoster(inputPath, outputPath) {
  await execFileAsync(
    "ffmpeg",
    ["-y", "-i", inputPath, "-ss", "0.4", "-frames:v", "1", "-vf", "scale=1080:-2", outputPath],
    { maxBuffer: 8 * 1024 * 1024 },
  );
}

export async function handler(event) {
  const record = event.Records?.[0];
  if (!record) {
    return { ok: true };
  }

  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  const { gameId, clipId } = parseUploadKey(key);
  const workdir = path.join("/tmp", clipId);

  try {
    await mkdir(workdir, { recursive: true });
    const sourcePath = path.join(workdir, "source");
    const playbackPath = path.join(workdir, "playback.mp4");
    const posterPath = path.join(workdir, "poster.jpg");
    const playbackKey = `playback/${gameId}/${clipId}/playback.mp4`;
    const posterKey = `posters/${gameId}/${clipId}/poster.jpg`;

    await downloadObject(bucket, key, sourcePath);
    await transcode(sourcePath, playbackPath);
    await makePoster(sourcePath, posterPath);
    const durationMs = await probeDurationMs(playbackPath);

    await uploadFile(bucket, playbackKey, playbackPath, "video/mp4");
    await uploadFile(bucket, posterKey, posterPath, "image/jpeg");

    await postWebhook({
      clipId,
      status: "ready",
      originalKey: key,
      playbackKey,
      posterKey,
      durationMs,
    });
  } catch (error) {
    console.error(error);
    try {
      await postWebhook({
        clipId,
        status: "failed",
        originalKey: key,
        error: error instanceof Error ? error.message : "Transcode failed",
      });
    } catch (webhookError) {
      console.error("Failed to report transcode error", webhookError);
    }
    throw error;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }

  return { ok: true };
}

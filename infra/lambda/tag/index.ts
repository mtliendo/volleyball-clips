import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Client } from "pg";
import { tagClipPlayback } from "../../../src/lib/ai-tag-pipeline";
import { GEMINI_AI_TAG_MODEL, type ClipAiTagRecord } from "../../../src/lib/ai-tags";
import { replaceClipCatalogTags } from "../../../src/lib/clip-catalog-tags";
import { createGeminiTagClient } from "../../../src/lib/gemini-files";

const s3 = new S3Client({});
const ssm = new SSMClient({});

let cachedGeminiKey: string | undefined;
let cachedDatabaseUrl: string | undefined;

type SqsEvent = {
  Records?: { messageId: string; body: string }[];
};

async function readSecret(name: string | undefined) {
  if (!name) {
    throw new Error("Missing SSM parameter name");
  }
  const result = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter ${name} has no value`);
  }
  return value;
}

async function getGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  cachedGeminiKey ??= await readSecret(process.env.GEMINI_API_KEY_PARAMETER);
  return cachedGeminiKey;
}

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  cachedDatabaseUrl ??= await readSecret(process.env.DATABASE_URL_PARAMETER);
  return cachedDatabaseUrl;
}

async function withDb<T>(work: (db: Client) => Promise<T>) {
  const db = new Client({
    connectionString: await getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  try {
    return await work(db);
  } finally {
    await db.end();
  }
}

async function saveAiRecord(db: Client, record: ClipAiTagRecord) {
  await db.query(
    `INSERT INTO clip_ai_tags (
       clip_id, status, summary, actions, rally_count, longest_rally_s,
       highlight_score, tags, mapped_tag_slugs, model, error, tagged_at, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, now(), now()
     )
     ON CONFLICT (clip_id) DO UPDATE SET
       status = EXCLUDED.status,
       summary = EXCLUDED.summary,
       actions = EXCLUDED.actions,
       rally_count = EXCLUDED.rally_count,
       longest_rally_s = EXCLUDED.longest_rally_s,
       highlight_score = EXCLUDED.highlight_score,
       tags = EXCLUDED.tags,
       mapped_tag_slugs = EXCLUDED.mapped_tag_slugs,
       model = EXCLUDED.model,
       error = EXCLUDED.error,
       tagged_at = EXCLUDED.tagged_at,
       updated_at = now()`,
    [
      record.clipId,
      record.status,
      record.summary,
      record.actions ? JSON.stringify(record.actions) : null,
      record.rallyCount,
      record.longestRallyS,
      record.highlightScore,
      record.tags ? JSON.stringify(record.tags) : null,
      record.mappedTagSlugs ? JSON.stringify(record.mappedTagSlugs) : null,
      record.model,
      record.error,
      record.taggedAt,
    ],
  );
}

async function replaceCatalogTags(db: Client, clipId: string, tagIds: string[]) {
  await replaceClipCatalogTags((sql, params) => db.query(sql, params), clipId, tagIds);
}

async function downloadPlayback(key: string) {
  const bucket = process.env.BUCKET;
  if (!bucket) {
    throw new Error("BUCKET is not set");
  }
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) {
    throw new Error(`S3 object ${key} has no body`);
  }
  return object.Body.transformToByteArray();
}

export async function processClipId(clipId: string) {
  if (!clipId) {
    throw new Error("clipId is required");
  }

  await withDb(async (db) => {
    const clipResult = await db.query<{
      id: string;
      playback_key: string | null;
      status: string;
      tags_locked: boolean;
    }>(
      "SELECT id, playback_key, status, tags_locked FROM clips WHERE id = $1",
      [clipId],
    );
    const clip = clipResult.rows[0];
    if (!clip) {
      throw new Error(`Clip ${clipId} not found`);
    }
    if (clip.status !== "ready" || !clip.playback_key) {
      throw new Error(`Clip ${clipId} is not ready for AI tagging`);
    }

    const catalog = (
      await db.query<{ id: string; slug: string }>("SELECT id, slug FROM tags")
    ).rows;

    await saveAiRecord(db, {
      clipId,
      status: "pending",
      summary: null,
      actions: null,
      rallyCount: null,
      longestRallyS: null,
      highlightScore: null,
      tags: null,
      mappedTagSlugs: null,
      model: process.env.GEMINI_MODEL ?? GEMINI_AI_TAG_MODEL,
      error: null,
      taggedAt: null,
    });

    const videoBytes = await downloadPlayback(clip.playback_key);
    const gemini = createGeminiTagClient({
      apiKey: await getGeminiKey(),
      model: process.env.GEMINI_MODEL ?? GEMINI_AI_TAG_MODEL,
    });

    await tagClipPlayback({
      clipId,
      videoBytes,
      fileName: `${clipId}.mp4`,
      catalog,
      tagsLocked: clip.tags_locked,
      gemini,
      save: (record) => saveAiRecord(db, record),
      replaceCatalogTags: (tagIds) => replaceCatalogTags(db, clipId, tagIds),
    });
  });
}

export async function handler(event: SqsEvent) {
  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records ?? []) {
    try {
      const payload = JSON.parse(record.body) as { clipId?: string };
      await processClipId(payload.clipId ?? "");
    } catch (error) {
      console.error("AI tag failed", record.messageId, error);
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
}

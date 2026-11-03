import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

function flag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = flag("--dry-run");
  const retryFailed = flag("--retry-failed");
  const retryStuck = flag("--retry-stuck");
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const queueUrl = process.env.AI_TAG_QUEUE_URL;
  const region = process.env.AWS_REGION ?? "us-east-2";

  if (!url) {
    throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required");
  }
  if (!dryRun && !queueUrl) {
    throw new Error("AI_TAG_QUEUE_URL is required (or pass --dry-run)");
  }

  const db = new Client({ connectionString: url });
  await db.connect();

  const result = await db.query<{
    id: string;
    playback_key: string | null;
    ai_status: string | null;
  }>(
    `SELECT clips.id, clips.playback_key, clip_ai_tags.status AS ai_status
     FROM clips
     LEFT JOIN clip_ai_tags ON clip_ai_tags.clip_id = clips.id
     WHERE clips.status = 'ready'
       AND clips.playback_key IS NOT NULL
       AND (
         clip_ai_tags.clip_id IS NULL
         ${retryFailed ? "OR clip_ai_tags.status = 'failed'" : ""}
         ${retryStuck ? "OR (clip_ai_tags.status = 'pending' AND clip_ai_tags.updated_at < now() - interval '15 minutes')" : ""}
       )
     ORDER BY clips.created_at ASC`,
  );

  await db.end();

  console.log(`Found ${result.rows.length} ready clip(s) to enqueue`);
  if (dryRun) {
    for (const row of result.rows) {
      console.log(`${row.id}\t${row.ai_status ?? "none"}\t${row.playback_key}`);
    }
    return;
  }

  const sqs = new SQSClient({ region });
  let sent = 0;
  for (const row of result.rows) {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          clipId: row.id,
          playbackKey: row.playback_key,
        }),
      }),
    );
    sent += 1;
    if (sent % 25 === 0) {
      console.log(`Enqueued ${sent}/${result.rows.length}`);
    }
  }
  console.log(`Enqueued ${sent} clip(s) to ${queueUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

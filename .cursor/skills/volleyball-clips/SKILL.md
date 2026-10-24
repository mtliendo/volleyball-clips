---
name: volleyball-clips
description: Architecture and conventions for Focus's volleyball-clips Next.js app, Neon/Drizzle schema, Auth0 admin, S3 presigned uploads, and AWS CDK media pipeline.
---

# Volleyball clips

Vertical Meta-glasses volleyball clips. Public calendar + game feed; any signed-in Auth0 user is an admin.

## Stack

- Next.js App Router (`src/app`), TypeScript, Tailwind v4, pnpm
- Neon Postgres via Drizzle (`src/lib/db/schema.ts`)
- Auth0 `@auth0/nextjs-auth0` v4 (`src/lib/auth0.ts`, `src/proxy.ts`)
- Vercel hosting; AWS media in `us-east-2` via CDK in `/infra`
- Uploads: browser → S3 presigned PUT; transcode Lambda → signed webhook

## Data

- `venues.name`
- `games`: venue, `starts_at` timestamptz, type `open_gym|league|tournament`
- `clips`: game, `original_key` / `playback_key` / `poster_key`, `duration_ms`, status `uploading|processing|ready|failed`, `created_at`
- `tags` (admin-managed; seed spike/block/dig/ace/set/save/rally) and `clip_tags`

Calendar grouping uses `APP_TIMEZONE` (default `America/Chicago`).

## Auth model

Sign-ups are disabled in Auth0. Do not invent roles. `requireAdminPage` / `requireAdminApi` in `src/lib/admin.ts` check for a session on every admin page and `/api/admin/*` route. `src/proxy.ts` also gates those paths.

Public pages and `POST /api/webhooks/transcode` stay anonymous. The webhook is HMAC-verified with `TRANSCODE_WEBHOOK_SECRET` (`x-webhook-signature: sha256=...`). That env var is the decrypted SSM SecureString `/volleyball-clips/transcode-webhook-secret` (create once with `aws ssm put-parameter --type SecureString`). The Lambda reads the same parameter with `ssm:GetParameter` (`WithDecryption`).

## Upload path

1. Admin game page (`src/app/admin/games/[id]/page.tsx`) multi-selects videos.
2. `POST /api/admin/clips/presign` creates a clip (`uploading`) and a per-key presigned PUT (video types, ≤1 GB, 15 min).
3. Browser PUTs to S3; then `POST /api/admin/clips/[id]/complete` sets `processing`.
4. S3 `uploads/` event runs the ffmpeg Lambda. It writes `playback/{gameId}/{clipId}/playback.mp4` (1080-wide H.264 ~5 Mbps/30 fps, faststart) and `posters/.../poster.jpg`, then webhooks the app.
5. Tags are assigned after upload via `PUT /api/admin/clips/[id]/tags`.

S3 credentials: `@vercel/functions/oidc` `awsCredentialsProvider({ roleArn: AWS_ROLE_ARN })` on Vercel. Locally, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are allowed.

The Vercel OIDC role may only presign `uploads/*` (`s3:PutObject`, multipart abort/list). Do not broaden it.

## Public UI

- `/` month calendar; `?ym=YYYY-MM&d=YYYY-MM-DD` lists that day's games
- `/games/[id]` phone-first 9:16 feed of **ready** clips, tag filter, CloudFront download of the original (`uploads/*` has `Content-Disposition: attachment`)

Keep it mobile-first. Court orange on a dark court.

## Infra

`/infra` CDK stack `VolleyballClipsStack`, region `us-east-2`, tag `project=volleyball-clips`. Do not deploy from an agent unless asked; Focus's bot deploys.

```bash
cd infra
pnpm install
pnpm exec cdk deploy -c webhookUrl=https://<app-host>/api/webhooks/transcode -c allowedOrigins=http://localhost:3000,https://<app-host>
```

`pnpm deploy` also downloads the ffmpeg layer binaries first.

If the account already has `https://oidc.vercel.com/focus-otters-projects`, pass `-c vercelOidcProviderArn=arn:aws:iam::<account>:oidc-provider/oidc.vercel.com/focus-otters-projects`.

Stack outputs the app needs: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ROLE_ARN`, `NEXT_PUBLIC_CDN_URL`, plus `TRANSCODE_WEBHOOK_SECRET_PARAMETER` (the SSM name). Set app env `TRANSCODE_WEBHOOK_SECRET` from that parameter's decrypted value, not from Secrets Manager.

## Schema changes

Edit `src/lib/db/schema.ts`, then `pnpm db:generate` and commit `drizzle/`. Apply with `pnpm db:migrate` against `DATABASE_URL_UNPOOLED`. Seed tags with `pnpm db:seed`.

## Conventions

- No tests unless asked
- Check session on the server for admin work; do not trust the client
- Presign from the server; never send AWS keys to the browser
- Keep Lambda scoped to transcode + webhook
- Document new env vars in `.env.example` and the README

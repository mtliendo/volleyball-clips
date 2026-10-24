# volleyball-clips

Vertical Meta-glasses volleyball clips for Focus. Public visitors browse a month calendar, open a day's games, and watch a phone-first 9:16 feed. Any signed-in Auth0 user is an admin and can manage venues, tags, games, and parallel camera-roll uploads.

## Architecture

```
phone / laptop
   │
   ├─ public Next.js pages ── Neon (venues, games, ready clips, tags)
   │
   └─ admin (Auth0 session)
        │
        ├─ CRUD APIs ── Neon
        └─ POST /api/admin/clips/presign
              │
              └─ browser PUT ── S3 uploads/{gameId}/{clipId}/…
                                    │
                                    ├─ Lambda + ffmpeg layer
                                    │     writes playback/ and posters/
                                    │     POST /api/webhooks/transcode (HMAC)
                                    │
                                    └─ CloudFront (OAC)
                                          playback + posters inline
                                          uploads/* as Content-Disposition: attachment
```

- **App:** Next.js App Router on Vercel, TypeScript, Tailwind, pnpm.
- **DB:** Neon Postgres, Drizzle schema in `src/lib/db/schema.ts`.
- **Auth:** `@auth0/nextjs-auth0` v4. Sign-ups are disabled in Auth0; the app only checks for a session.
- **AWS (us-east-2, tag `project=volleyball-clips`):** private S3 bucket, CloudFront with origin access control, transcode Lambda, IAM role for Vercel OIDC.

S3 keys:

| Prefix | Purpose |
| --- | --- |
| `uploads/{gameId}/{clipId}/…` | Original phone file (source + download) |
| `playback/{gameId}/{clipId}/playback.mp4` | 1080-wide H.264 ~5 Mbps / 30 fps, faststart |
| `posters/{gameId}/{clipId}/poster.jpg` | Still for the player |

Vercel talks to AWS with `@vercel/functions/oidc` `awsCredentialsProvider`. The federated role can only `s3:PutObject` / abort or list multipart uploads on `uploads/*`.

## App setup

```bash
pnpm install
cp .env.example .env.local
# fill Neon + Auth0 + (after CDK deploy) stack outputs
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm db:migrate` must use the **unpooled** Neon URL (`DATABASE_URL_UNPOOLED`). The app itself uses the pooled `DATABASE_URL`. The first migration also inserts the seed tags; `pnpm db:seed` is idempotent and safe to re-run.

## Environment variables

### From you (manual)

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (migrations / seed) |
| `AUTH0_SECRET` | `openssl rand -hex 32` |
| `APP_BASE_URL` | `http://localhost:3000` locally; the Vercel URL in production |
| `AUTH0_DOMAIN` | Auth0 tenant host, no `https://` |
| `AUTH0_CLIENT_ID` | Auth0 Regular Web Application |
| `AUTH0_CLIENT_SECRET` | Auth0 Regular Web Application |
| `APP_TIMEZONE` | Optional. Defaults to `America/Chicago` |

### From `VolleyballClipsStack` outputs

Copy these CloudFormation outputs into Vercel (and `.env.local` after a deploy):

| Output / env var | Used for |
| --- | --- |
| `AWS_REGION` | Always `us-east-2`. Set it explicitly on Vercel so functions do not pick a different region. |
| `AWS_S3_BUCKET` | Bucket name for presigned PUTs |
| `AWS_ROLE_ARN` | Vercel OIDC role assumed by `awsCredentialsProvider` |
| `NEXT_PUBLIC_CDN_URL` | `https://<cloudfront-domain>` for playback, posters, and original downloads |
| `TRANSCODE_WEBHOOK_SECRET` | Shared HMAC for `POST /api/webhooks/transcode` |

Local uploads can use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` instead of OIDC. Do not set those on Vercel.

## Neon

1. Create a project (region close to `us-east-2` is fine).
2. Copy the pooled and direct connection strings into `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Run `pnpm db:migrate` (creates tables and inserts the seed tags: `spike`, `block`, `dig`, `ace`, `set`, `save`, `rally`). Optionally re-run `pnpm db:seed` later; it is idempotent.
4. Schema changes: edit `src/lib/db/schema.ts`, `pnpm db:generate`, commit `drizzle/`, migrate.

## Auth0

1. Create a **Regular Web Application** (not an SPA).
2. Allowed Callback URLs: `http://localhost:3000/auth/callback` and `https://<app-host>/auth/callback`.
3. Allowed Logout URLs: `http://localhost:3000` and `https://<app-host>`.
4. Allowed Web Origins: the same two origins.
5. Disable sign-ups in Authentication → Database (or your social connections). Invite or create the admin users yourself.
6. Paste domain, client id, secret, and a 64-hex `AUTH0_SECRET` into env.

v4 routes are `/auth/login`, `/auth/callback`, `/auth/logout`.

## CDK deploy

Do not deploy this stack from a coding agent. Focus's bot deploys AWS. From a machine with AWS credentials for the target account:

```bash
cd infra
pnpm install
./scripts/prepare-ffmpeg-layer.sh
npx cdk deploy \
  -c webhookUrl=https://<app-host>/api/webhooks/transcode \
  -c allowedOrigins=http://localhost:3000,https://<app-host>
```

`pnpm deploy` in `/infra` is the same thing (it prepares the ffmpeg layer first).

Useful context flags:

| Flag | Default | Purpose |
| --- | --- | --- |
| `webhookUrl` | placeholder Vercel URL | Lambda callback |
| `allowedOrigins` | `http://localhost:3000` | S3 CORS + CloudFront CORS |
| `vercelTeamSlug` | `focus-otters-projects` | OIDC issuer `https://oidc.vercel.com/<slug>` |
| `vercelProjectName` | `volleyball-clips` | Trust `sub` claim |
| `vercelOidcProviderArn` | unset (create provider) | Import an existing Vercel OIDC provider |

The stack is `VolleyballClipsStack` in `us-east-2`. Every resource is tagged `project=volleyball-clips`.

To validate the template without deploying:

```bash
cd infra
pnpm install
npx cdk synth
```

After deploy, add the five stack outputs to the Vercel project. Redeploy the app so `NEXT_PUBLIC_CDN_URL` is baked in. Then add the production origin to `allowedOrigins` and redeploy the stack if you did not pass it the first time.

If the AWS account already has `oidc.vercel.com/focus-otters-projects`, pass `vercelOidcProviderArn` instead of creating a second provider.

The Lambda is 10 GB RAM, 15 minute timeout, 5 GB ephemeral disk, Node.js 22 + ffmpeg layer. That is sized for ~2 minute HEVC sources (1552×2064, ~15 Mbps, sometimes 120 fps). Output is 1080-wide H.264 at ~5 Mbps / 30 fps with `+faststart`, plus a poster JPG.

## Vercel

- Framework: Next.js. Install command `pnpm install`, build `pnpm build`.
- Enable OIDC (team issuer). Team slug: `focus-otters-projects`.
- Set `AWS_REGION=us-east-2` yourself; do not rely on the platform default.
- `AWS_ROLE_ARN` is the stack output. The trust policy allows `owner:focus-otters-projects:project:volleyball-clips:environment:*`.

## Admin upload notes

On a phone, the admin game page's file input opens the camera roll (`accept="video/*"`, `multiple`). Files upload in parallel (3 at a time) with progress bars. The presigned URL is scoped to one key and one `Content-Type`. After the PUT succeeds, tag the clip on the same page.

Public visitors only see clips in `ready`.

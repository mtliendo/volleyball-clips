# volleyball-clips

Vertical Meta-glasses volleyball clips for Focus. Public visitors browse a month calendar, open a day's games, and watch a phone-first 9:16 feed. Public Auth0 sign-ups (email/password + Google) are enabled; only users with the Auth0 `admin` role can manage venues, tags, games, and parallel camera-roll uploads.

## Architecture

```
phone / laptop
   │
   ├─ public Next.js pages ── Neon (venues, games, ready clips, tags)
   │
   └─ admin (Auth0 session)
        │
        ├─ CRUD APIs ── Neon (venues, tags, games, clip tags)
        ├─ PATCH /api/admin/games/:id ── venue, starts_at, type
        ├─ DELETE /api/admin/games/:id ── S3 objects first, then game + clips + tag joins
        ├─ DELETE /api/admin/clips/:id ── S3 objects first, then clip + tag joins
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
- **Auth:** `@auth0/nextjs-auth0` v4. Public sign-ups are enabled. Admin access is the Auth0 `admin` role, delivered on the session as `user["https://vbpov.com/roles"]` (see Auth0 below).
- **AWS (us-east-2, tag `project=volleyball-clips`):** private S3 bucket, CloudFront with origin access control, transcode Lambda, IAM role for Vercel OIDC.

S3 keys:

| Prefix | Purpose |
| --- | --- |
| `uploads/{gameId}/{clipId}/…` | Original phone file (source + download) |
| `playback/{gameId}/{clipId}/playback.mp4` | 1080-wide H.264 ~5 Mbps / 30 fps, faststart |
| `posters/{gameId}/{clipId}/poster.jpg` | Still for the player |

Vercel talks to AWS with `@vercel/functions/oidc` `awsCredentialsProvider`. The federated role `volleyball-clips-vercel-presign` can:

- `s3:PutObject` / abort or list multipart uploads on `uploads/*` (presign)
- `s3:DeleteObject` on `uploads/*`, `playback/*`, and `posters/*` (signed-in clip/game delete)

It still cannot read objects, list the bucket, or touch Glacier.

### S3 storage classes and lifecycle

Configured on `VolleyballClipsStack` (not applied until you run `cdk deploy`):

| Prefix | Storage | Lifecycle |
| --- | --- | --- |
| `uploads/` | Intelligent-Tiering | Transition at day 0 |
| `playback/` | Intelligent-Tiering | Transition at day 0 |
| `posters/` | Standard | No transition (leave as-is) |
| *(bucket-wide)* | — | Abort incomplete multipart uploads after 7 days |

Intelligent-Tiering Frequent/Infrequent Access stays instantly readable, so public full-res downloads (`uploads/*` via CloudFront) stay instant. The stack does **not** enable Intelligent-Tiering Archive Access or Deep Archive Access, and it does **not** transition to Glacier Flexible Retrieval or Glacier Deep Archive.

### Admin edit and delete

Only a session whose `https://vbpov.com/roles` claim includes `admin` is authorized (`isAdmin` in `src/lib/roles.ts`, used by `requireAdminApi` / `requireAdminPage` and `src/proxy.ts`). Signed-out visitors are sent to login. Signed-in non-admins get `403` on `/api/admin/*` and the `/not-authorized` page for `/admin`. The transcode webhook is unchanged (HMAC, not Auth0).

- **Edit a game** on `/games/[id]` (admin panel) or `/admin/games/[id]/edit`: venue from the saved list, date/time, and type. `PATCH /api/admin/games/:id`.
- **Delete a clip** on the public game feed (admin) or the admin tag editor: confirm dialog, then `DELETE /api/admin/clips/:id`.
- **Delete a game and all its clips** on the public game page or admin game page: confirm dialog, then `DELETE /api/admin/games/:id`.

Delete order: S3 objects first (original + conventional `playback/` and `posters/` keys), then `clip_tags`, then `clips`, then `games`. If any S3 delete fails, the API returns `502` and leaves the database rows in place so you can retry (S3 `DeleteObject` is idempotent, including missing keys).

## App setup

```bash
pnpm install
cp .env.example .env.local
# fill Neon + Auth0 + stack outputs + SSM webhook secret
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
| `TRANSCODE_WEBHOOK_SECRET` | Decrypted value of the SSM SecureString `/volleyball-clips/transcode-webhook-secret` (see below). Not a CloudFormation output. |

### From `VolleyballClipsStack` outputs

Copy these CloudFormation outputs into Vercel (and `.env.local` after a deploy):

| Output / env var | Used for |
| --- | --- |
| `AWS_REGION` | Always `us-east-2`. Set it explicitly on Vercel so functions do not pick a different region. |
| `AWS_S3_BUCKET` | Bucket name for presigned PUTs |
| `AWS_ROLE_ARN` | Vercel OIDC role assumed by `awsCredentialsProvider` |
| `NEXT_PUBLIC_CDN_URL` | `https://<cloudfront-domain>` for playback, posters, and original downloads |
| `TRANSCODE_WEBHOOK_SECRET_PARAMETER` | Name of the SSM SecureString. Create it once, then put the decrypted value in `TRANSCODE_WEBHOOK_SECRET`. |

Local uploads can use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` instead of OIDC. Do not set those on Vercel.

## Neon

1. Create a project (region close to `us-east-2` is fine).
2. Copy the pooled and direct connection strings into `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Run `pnpm db:migrate` (creates tables and inserts the seed tags: `spike`, `block`, `dig`, `ace`, `set`, `save`, `rally`). Optionally re-run `pnpm db:seed` later; it is idempotent.
4. Schema changes: edit `src/lib/db/schema.ts`, `pnpm db:generate`, commit `drizzle/`, migrate.

## Auth0

The live app uses a dedicated Auth0 tenant with **public sign-ups** (email/password + Google). Swapping tenant keys in Vercel is enough; the app has no extra Auth0 env vars.

1. Create a **Regular Web Application** (not an SPA).
2. Allowed Callback URLs: `http://localhost:3000/auth/callback` and `https://<app-host>/auth/callback`.
3. Allowed Logout URLs: `http://localhost:3000` and `https://<app-host>`.
4. Allowed Web Origins: the same two origins.
5. Enable sign-ups on the Database connection and the Google social connection.
6. Create an Auth0 Role named `admin`. Assign it only to users who should upload or manage clips. There is no email allowlist in the app.
7. Deploy a **post-login Action** that copies the user's role names (string array) onto both the ID token and the access token under the custom claim `https://vbpov.com/roles`. The tenant going live already has this Action; a new tenant must have the same Action or every signed-in user will look like a non-admin.
8. Paste domain, client id, secret, and a 64-hex `AUTH0_SECRET` into env.

The app treats someone as an admin only when `isAdmin(session)` is true — that is, `session.user["https://vbpov.com/roles"]` is an array that includes `"admin"`. `@auth0/nextjs-auth0` v4 persists only a default claim subset, so `beforeSessionSaved` in `src/lib/auth0.ts` keeps this roles claim on the session user.

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

This repo does not run `cdk deploy` for you. After pull, from a machine with AWS credentials for the target account, deploy so the following CloudFormation updates land:

1. **Media bucket lifecycle** — two prefix rules (`uploads/`, `playback/`) transitioning existing and new objects to `INTELLIGENT_TIERING` at day 0; one bucket-wide rule aborting incomplete multipart uploads after 7 days. `posters/` is unchanged (Standard). No `IntelligentTieringConfiguration` archive tiers, no Glacier classes.
2. **IAM `volleyball-clips-vercel-presign`** — new statement `DeleteClipMedia`: `s3:DeleteObject` on `uploads/*`, `playback/*`, `posters/*`. Presign permissions are unchanged. The role description now mentions deletes.
3. **Unchanged** — bucket name, CloudFront, Lambda, OIDC trust, SSM parameter name, stack outputs.

Preview first with `cd infra && pnpm install && npx cdk diff` (same `-c` flags as deploy). App-only delete/edit APIs work only after that IAM statement is live; until then S3 deletes return `502` and DB rows stay.

To validate the template without deploying:

```bash
cd infra
pnpm install
npx cdk synth
```

After deploy, add the four AWS stack outputs to the Vercel project (`AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ROLE_ARN`, `NEXT_PUBLIC_CDN_URL`). Create the webhook SecureString if you have not already (CloudFormation cannot), copy its value into `TRANSCODE_WEBHOOK_SECRET`, and redeploy the app so `NEXT_PUBLIC_CDN_URL` is baked in. Then add the production origin to `allowedOrigins` and redeploy the stack if you did not pass it the first time.

If the AWS account already has `oidc.vercel.com/focus-otters-projects`, pass `vercelOidcProviderArn` instead of creating a second provider.

The Lambda is 10 GB RAM, 15 minute timeout, 5 GB ephemeral disk, Node.js 22 + ffmpeg layer. That is sized for ~2 minute HEVC sources (1552×2064, ~15 Mbps, sometimes 120 fps). Output is 1080-wide H.264 at ~5 Mbps / 30 fps with `+faststart`, plus a poster JPG.

## Transcode webhook secret (SSM)

CloudFormation cannot create an SSM `SecureString`. Create the parameter once in `us-east-2` (before the first upload). The transcode Lambda reads it with `ssm:GetParameter` (`WithDecryption`); that is the only extra IAM action on the function.

```bash
SECRET="$(openssl rand -hex 32)"
aws ssm put-parameter \
  --name /volleyball-clips/transcode-webhook-secret \
  --description "HMAC secret for volleyball-clips transcode webhook" \
  --type SecureString \
  --value "$SECRET" \
  --region us-east-2
# set TRANSCODE_WEBHOOK_SECRET to the same $SECRET in Vercel and .env.local
```

If the parameter already exists and you need the value for the app:

```bash
aws ssm get-parameter \
  --name /volleyball-clips/transcode-webhook-secret \
  --with-decryption \
  --query Parameter.Value \
  --output text \
  --region us-east-2
```

The stack output `TRANSCODE_WEBHOOK_SECRET_PARAMETER` is that name. Do not put the decrypted secret in CloudFormation.

## Vercel

- Framework: Next.js. Install command `pnpm install`, build `pnpm build`.
- Enable OIDC (team issuer). Team slug: `focus-otters-projects`.
- Set `AWS_REGION=us-east-2` yourself; do not rely on the platform default.
- `AWS_ROLE_ARN` is the stack output. The trust policy allows `owner:focus-otters-projects:project:volleyball-clips:environment:*`. After the IAM update above, that role can also delete clip objects; it still must not get `ssm:GetParameter` or `s3:GetObject`.
- Set `TRANSCODE_WEBHOOK_SECRET` to the decrypted SSM SecureString. Do not grant the Vercel role `ssm:GetParameter`.

## Admin upload notes

On a phone, the admin game page's file input opens the camera roll (`accept="video/*"`, `multiple`). Files upload in parallel (3 at a time) with progress bars. The presigned URL is scoped to one key and one `Content-Type`. After the PUT succeeds, tag the clip on the same page.

Public visitors only see clips in `ready`.

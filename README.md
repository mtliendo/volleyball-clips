# VB POV

Volleyball clips from Meta glasses for Focus ([vbpov.com](https://vbpov.com)). Public visitors pick a night, open a session grid, then swipe a TikTok-style 9:16 feed. Signed-in viewers can favorite clips and download. Pro ($5/month, Stripe test mode) gets unlimited original-quality downloads. Public Auth0 sign-ups (email/password + Google) are enabled; only users with the Auth0 `admin` role on the claim `https://vbpov.com/roles` can manage venues, tags, games, and uploads.

## Features

- **Nights:** month calendar (`?ym=YYYY-MM&d=YYYY-MM-DD`) lists that day’s sessions (venue, time, type: open gym, league, tournament).
- **Session grid:** every ready clip, pins first. Optional pin labels: Longest rally, Best dig, Super spike. Each label at most once per session, max 3 pins.
- **Feed:** tap a clip for a full-screen vertical swipe feed starting on that clip. Deep link `/games/{id}/watch/{clipId}`. Tag filter is respected. The first clip autoplays muted; tap the sound control (or the video) to unmute. One persistent player element stays mounted and keeps that unlock across swipes (iOS Safari treats unmuted play as per-element). The sound icon follows `video.muted`. Neighbors preload muted. Admins can set the session pin from a sheet on this screen, and open a clip’s edit page for tags. Close returns to the grid.
- **AI tags:** after the 1080p playback copy is ready, a Lambda sends the clip to Gemini 3.8 Flash and writes play-type tags (spike, set, block, rally, and the rest of the catalog) plus a short summary. The first backfill **replaces** existing `clip_tags` on every ready clip (`tags_locked` starts false). After someone saves tags on the per-clip admin page, later AI runs leave `clip_tags` alone. Filter chips on the session grid use the same tags, whether they came from AI or an admin.
- **Accounts:** public Auth0 sign-up (Google + email/password). `users` is keyed by Auth0 `sub`.
- **Favorites:** heart on the grid and in the feed. `/favorites` lists them.
- **Watch limit:** anonymous visitors get **7 unique clips per day** (pins count). Tracked server-side with an HttpOnly `vb_vid` cookie plus a hashed IP backstop. Already-watched clips replay. Signed-in users and admins are not limited.
- **Downloads:**
  - Free account: **3 per rolling week**, 1080p `playback/` copy.
  - Pro: unlimited **originals** (`uploads/`, ~1400×1900 at 120 fps).
  - Admin: never limited, originals.
- **Billing:** Stripe Checkout ($5/month) and Customer Portal. Webhooks write subscription status. Access lasts through `current_period_end` after cancel. Missing Stripe env vars degrade: the pricing page still renders, checkout/portal/webhooks return 503.

## Limits (quick)

| Who | Watch | Download |
| --- | --- | --- |
| Guest | 7 unique clips / day | none |
| Free account | unlimited | 3 / rolling week, 1080p |
| Pro | unlimited | unlimited originals |
| Admin | unlimited | unlimited originals |

## Design system

Hallmark is used for craft only (tokens, type scale, spacing, focus, reduced motion). The look is original: a dark, loud, mobile-first night court. Inspo is the visual source; nothing is cloned, and the site is not meant to resemble Hassan’s own work.

- **generalcondition-com**: electric red signal and type slam on the home hero
- **beardmeatsfood-co-uk**: display size and spark lime on pins / Pro
- **mikkisindhunata-com**: type over a photographic stage (here a rack of 9:16 posters)
- **music-youtube-com**: dark session grid and filter chips
- **artek-fi**: Pro as the featured pricing product
- **audius-co**: quiet Guest and Free stacks
- **audocph-com**: originals callout on the Pro card

Tokens live in `src/app/tokens.css`. Display is Tektur, body is Onest. Paper is a red-tinted night (`oklch(16% 0.018 18)`), accent is electric red used as a fill on actions, spark lime is reserved for pins and Pro.

## Architecture

```
phone / laptop
   │
   ├─ public Next.js pages ── Neon (venues, games/sessions, clips, tags, clip_ai_tags, pins, users, favorites, watch/download events)
   │
   ├─ Auth0 (public sign-up) ── users.auth0_sub
   │     admin role via https://vbpov.com/roles
   │
   ├─ Stripe Checkout + portal + webhooks (TEST)
   │
   └─ admin (isAdmin only)
        │
        ├─ CRUD APIs ── Neon (venues, tags, games, clip tags, pins)
        ├─ PATCH /api/admin/games/:id ── venue, starts_at, type
        ├─ PUT /api/admin/games/:id/pins ── up to 3 pins
        ├─ DELETE /api/admin/games/:id ── S3 objects first, then game + clips + joins
        ├─ DELETE /api/admin/clips/:id ── S3 objects first, then clip + joins
        └─ POST /api/admin/clips/presign
              │
              └─ browser PUT ── S3 uploads/{gameId}/{clipId}/…
                                    │
                                    ├─ Lambda + ffmpeg layer
                                    │     writes playback/ and posters/
                                    │     POST /api/webhooks/transcode (HMAC)
                                    │     then SQS → AI tag Lambda (Gemini) → clip_ai_tags + clip_tags
                                    │
                                    └─ CloudFront (OAC)
                                          posters/* public (Open Graph cards)
                                          playback/* require a CloudFront signed URL when lockPlayback=true
                                          uploads/* require a CloudFront signed URL when lockUploads=true
                                          (same trusted key group; Pro originals and free 1080p
                                          downloads proxy through the app)
```

- **App:** Next.js App Router on Vercel, TypeScript, Tailwind v4, pnpm.
- **DB:** Neon Postgres, Drizzle schema in `src/lib/db/schema.ts`.
- **Auth:** `@auth0/nextjs-auth0` v4. Public sign-ups are enabled. Admin access is the Auth0 `admin` role, delivered on the session as `user["https://vbpov.com/roles"]` (see Auth0 below).
- **AWS (us-east-2, tag `project=volleyball-clips`):** private S3 bucket, CloudFront with origin access control, transcode Lambda, AI tag SQS queue + DLQ + Lambda, IAM role for Vercel OIDC.

S3 keys:

| Prefix | Purpose |
| --- | --- |
| `uploads/{gameId}/{clipId}/…` | Original glasses file (Pro download) |
| `playback/{gameId}/{clipId}/playback.mp4` | 1080-wide H.264 ~5 Mbps / 30 fps, faststart (feed + free download) |
| `posters/{gameId}/{clipId}/poster.jpg` | Still for the grid and player |

The watch page and public APIs never send `originalKey` or any `uploads/` URL. Free downloads never serve `uploads/`. Pro originals and free 1080p downloads are fetched server-side with a short-lived CloudFront signed URL (`CLOUDFRONT_KEY_PAIR_ID` + `CLOUDFRONT_PRIVATE_KEY`) and streamed from `/api/clips/:id/download` as an attachment.

Feed playback uses a **per-clip signed URL** (2 hour TTL, refreshed ~10 minutes before expiry), not signed cookies. The CDN is the CloudFront default host (`*.cloudfront.net`), so the app cannot set cookies for that domain from `vbpov.com`. `POST /api/watch` issues the URL only after it allows the view (anonymous 7-a-day cap still applies). Signed-in viewers get start+neighbor URLs on the first HTML response so autoplay and preload stay snappy. When signing env is unset, the app falls back to public `cdnUrl()` so you can ship the app before `lockPlayback=true`. Posters stay public. The transcode Lambda reads originals with S3 `GetObject`, not CloudFront.

Vercel talks to AWS with `@vercel/functions/oidc` `awsCredentialsProvider`. The federated role `volleyball-clips-vercel-presign` can:

- `s3:PutObject` / abort or list multipart uploads on `uploads/*` (presign)
- `s3:DeleteObject` on `uploads/*`, `playback/*`, and `posters/*`

It still cannot read objects, list the bucket, or touch Glacier.

### S3 storage classes and lifecycle

Configured on `VolleyballClipsStack` (not applied until you run `cdk deploy`):

| Prefix | Storage | Lifecycle |
| --- | --- | --- |
| `uploads/` | Intelligent-Tiering | Transition at day 0 |
| `playback/` | Intelligent-Tiering | Transition at day 0 |
| `posters/` | Standard | No transition (leave as-is) |
| *(bucket-wide)* | — | Abort incomplete multipart uploads after 7 days |

Intelligent-Tiering Frequent/Infrequent Access stays instantly readable. The stack does **not** enable archive tiers or Glacier.

### Admin edit and delete

Only a session whose `https://vbpov.com/roles` claim includes `admin` is authorized (`isAdmin` in `src/lib/roles.ts`, used by `requireAdminApi` / `requireAdminPage` and `src/proxy.ts`). Signed-out visitors are sent to login. Signed-in non-admins get `403` on `/api/admin/*` and the `/not-authorized` page for `/admin`. The transcode webhook is unchanged (HMAC, not Auth0).

- **Edit a game** on `/games/[id]` (admin panel) or `/admin/games/[id]/edit`: venue from the saved list, date/time, and type. `PATCH /api/admin/games/:id`.
- **Edit a clip** on `/admin/games/[id]/clips/[clipId]` (from the session grid, the feed pin sheet, or the admin session page): add or remove tags, read the AI summary, delete the clip. Saving tags sets `tags_locked` so a later AI run cannot overwrite them. `PUT /api/admin/clips/:id/tags`, `DELETE /api/admin/clips/:id`.
- **Delete a game and all its clips** on the public game page or admin game page: confirm dialog, then `DELETE /api/admin/games/:id`.

## Auth model

`isAdmin(sessionOrUser)` reads `user["https://vbpov.com/roles"]` and returns true only when that list includes `admin`. It accepts a session (`{ user }`) or the user object. Reuse it everywhere — there is no email allowlist. `requireAdminPage` / `requireAdminApi` and `src/proxy.ts` send signed-in non-admins to `/not-authorized` (or 403 on APIs). The v2 feed tag sheet uses the same check via `getViewer().isAdmin`.

Add a Post-Login Action on tenant `vb-pov.us.auth0.com` so roles reach the ID token (v4 drops namespaced claims unless `beforeSessionSaved` copies them; the app already does that):

```js
exports.onExecutePostLogin = async (event, api) => {
  const namespace = "https://vbpov.com";
  if (event.authorization?.roles) {
    api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
    api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
  }
};
```

Create the `admin` role, assign it to Focus, enable Database + Google sign-up. Do not hardcode Facebook out; it can be added on the tenant later.

`users` is upserted from the Auth0 `sub` on first authenticated request.

## App setup

```bash
pnpm install
cp .env.example .env.local
# fill Neon (a branch for schema work) + Auth0 + stack outputs + Stripe test keys
pnpm db:migrate   # DATABASE_URL_UNPOOLED, never production when testing
pnpm db:seed
pnpm dev
```

`pnpm db:migrate` must use the **unpooled** Neon URL (`DATABASE_URL_UNPOOLED`). The app uses the pooled `DATABASE_URL`. Do **not** apply new migrations to the production database from an agent. Create a Neon branch, migrate that, then apply production yourself when you are ready.

The first migration also inserts the seed tags; `pnpm db:seed` is idempotent.

Schema changes: edit `src/lib/db/schema.ts`, `pnpm db:generate`, commit `drizzle/`.

## Environment variables

### From you (manual)

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (migrations / seed) |
| `AUTH0_SECRET` | `openssl rand -hex 32` |
| `APP_BASE_URL` | `http://localhost:3000` locally; `https://vbpov.com` in production |
| `AUTH0_DOMAIN` | Auth0 tenant host, no `https://` (`vb-pov.us.auth0.com`) |
| `AUTH0_CLIENT_ID` | Auth0 Regular Web Application |
| `AUTH0_CLIENT_SECRET` | Auth0 Regular Web Application |
| `APP_TIMEZONE` | Optional. Defaults to `America/Chicago` |
| `ANON_HASH_SECRET` | Optional HMAC key for the watch IP backstop. Falls back to `AUTH0_SECRET` |
| `TRANSCODE_WEBHOOK_SECRET` | Decrypted SSM `/volleyball-clips/transcode-webhook-secret` |
| `AI_TAG_QUEUE_URL` | Optional. Only for `pnpm ai-tags:enqueue` on your machine |
| `GEMINI_API_KEY` | Optional. Only for `pnpm ai-tags:dry-run -- --live`. Never set on Vercel |
| `CLOUDFRONT_PRIVATE_KEY` | Matching private key for `CLOUDFRONT_KEY_PAIR_ID`. PEM (newlines or `\n`) or base64. Never commit it |
| `STRIPE_SECRET_KEY` | Stripe **test** secret (`sk_test_…`). Optional; app degrades without it |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. Optional |
| `STRIPE_PRICE_ID` | Recurring $5/month test price. Optional |
| `STRIPE_PORTAL_CONFIG_ID` | Optional Customer Portal configuration id (`bpc_…`). Passed to `billingPortal.sessions.create` when set |

### From `VolleyballClipsStack` outputs

| Output / env var | Used for |
| --- | --- |
| `AWS_REGION` | Always `us-east-2` |
| `AWS_S3_BUCKET` | Bucket name for presigned PUTs |
| `AWS_ROLE_ARN` | Vercel OIDC role |
| `NEXT_PUBLIC_CDN_URL` | `https://<cloudfront-domain>` for playback and posters |
| `CLOUDFRONT_KEY_PAIR_ID` | CloudFront public key id (trusted key group). Required before locking `uploads/*` or `playback/*` |
| `TRANSCODE_WEBHOOK_SECRET_PARAMETER` | Name of the SSM SecureString |
| `AI_TAG_QUEUE_URL` | SQS queue the transcode Lambda and backfill script send to |
| `AI_TAG_DLQ_URL` | Dead-letter queue after 3 failed receives |
| `AI_TAG_FUNCTION_NAME` | Tagging Lambda name |
| `GEMINI_API_KEY_PARAMETER` | SSM name `/volleyball-clips/gemini-api-key` |
| `DATABASE_URL_PARAMETER` | SSM name `/volleyball-clips/database-url` |

Set `CLOUDFRONT_PRIVATE_KEY` yourself (PEM with real newlines or `\n`, or base64 of the PEM). Never put it in the repo or in CDK context. The app works without these vars while those prefixes are still public; after a CDK lock, unsigned objects 403 until the vars are set.

Local uploads can use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` instead of OIDC. Do not set those on Vercel.

## Stripe (TEST mode only)

1. Create a Stripe test secret key.
2. `pnpm stripe:setup` creates product **VB POV Pro** and a $5/month price, then prints `STRIPE_PRICE_ID`.
3. Or in the Dashboard: Product → recurring $5 USD / month → copy the price id.
4. Add a webhook endpoint `https://<app-host>/api/webhooks/stripe` (local: Stripe CLI `stripe listen --forward-to localhost:3000/api/webhooks/stripe`) for:

   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

5. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`.
6. Enable the Customer Portal in Stripe for cancel and card updates. Optional: create a portal configuration and set `STRIPE_PORTAL_CONFIG_ID` so the portal session uses it. Leave it unset to use Stripe’s default.

One more thing: if you will charge US or EU customers later, consider [Stripe Tax for recurring payments](https://docs.stripe.com/billing/taxes/collect-taxes). This app does not enable `automatic_tax`.

## Neon

1. Create a project (region close to `us-east-2` is fine).
2. Copy pooled and direct URLs into `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. For schema experiments, **create a branch** and migrate that. Do not migrate production from an agent.
4. `pnpm db:migrate` then optionally `pnpm db:seed`.

## Auth0

The live app uses a dedicated Auth0 tenant (`vb-pov.us.auth0.com`) with **public sign-ups** (email/password + Google). Swapping tenant keys in Vercel is enough; the app has no extra Auth0 env vars.

1. Create a **Regular Web Application** (not an SPA) on `vb-pov.us.auth0.com`.
2. Allowed Callback URLs: `http://localhost:3000/auth/callback` and `https://<app-host>/auth/callback`.
3. Allowed Logout URLs: `http://localhost:3000` and `https://<app-host>`.
4. Allowed Web Origins: the same two origins.
5. Enable sign-ups on the Database connection and the Google social connection. Facebook can wait.
6. Create an Auth0 Role named `admin`. Assign it only to users who should upload or manage clips. There is no email allowlist in the app.
7. Deploy a **post-login Action** that copies the user's role names (string array) onto both the ID token and the access token under the custom claim `https://vbpov.com/roles`. The tenant going live already has this Action; a new tenant must have the same Action or every signed-in user will look like a non-admin.
8. Paste domain, client id, secret, and a 64-hex `AUTH0_SECRET` into env.

The app treats someone as an admin only when `isAdmin(session)` is true — that is, `session.user["https://vbpov.com/roles"]` includes `"admin"`. `@auth0/nextjs-auth0` v4 persists only a default claim subset, so `beforeSessionSaved` in `src/lib/auth0.ts` keeps this roles claim on the session user (`filterDefaultIdTokenClaims` plus an ID-token fallback).

v4 routes are `/auth/login`, `/auth/callback`, `/auth/logout`. Sign-up: `/auth/login?screen_hint=signup`.

## CDK deploy

Do not deploy this stack from a coding agent. Focus’s bot deploys AWS. From a machine with AWS credentials:

```bash
cd infra
pnpm install
./scripts/prepare-ffmpeg-layer.sh
npx cdk deploy \
  -c webhookUrl=https://<app-host>/api/webhooks/transcode \
  -c allowedOrigins=http://localhost:3000,https://<app-host> \
  -c cloudfrontPublicKeyPath=./keys/cloudfront-public.pem \
  -c lockUploads=true \
  -c lockPlayback=false
```

Useful context flags: `webhookUrl`, `allowedOrigins`, `vercelTeamSlug` (`focus-otters-projects`), `vercelProjectName` (`volleyball-clips`), `vercelOidcProviderArn`, `cloudfrontPublicKeyPath` or `cloudfrontPublicKeyPem`, `lockUploads` (`true` locks unsigned `uploads/*`), `lockPlayback` (`true` locks unsigned `playback/*`; default `false` so the app can ship first). Posters stay on the default behavior and remain public.

Generate the signing keypair on the deploy machine (private key never enters git):

```bash
openssl genrsa -out cloudfront-private.pem 2048
openssl rsa -pubout -in cloudfront-private.pem -out cloudfront-public.pem
```

The stack is `VolleyballClipsStack` in `us-east-2`. Every resource is tagged `project=volleyball-clips`.

After deploy, set `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ROLE_ARN`, `NEXT_PUBLIC_CDN_URL`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY`, and `TRANSCODE_WEBHOOK_SECRET` on Vercel (preview and production). Then deploy the app, then `cdk deploy` again with `-c lockUploads=true` and, when ready, `-c lockPlayback=true`.

Lockdown check (preview or production):

```bash
pnpm exec playwright install chromium
pnpm verify:lockdown -- \
  --base-url https://<app-host> \
  --cdn-url https://<cloudfront-domain> \
  --original-key uploads/<gameId>/<clipId>/<file>.mp4 \
  --playback-key playback/<gameId>/<clipId>/playback.mp4 \
  --free-cookie '<Cookie header>' \
  --pro-cookie '<Cookie header>'
```

While `lockPlayback` is still false, set `VERIFY_EXPECT_PLAYBACK_UNLOCKED=1`. For a Vercel preview behind OIDC, set `VERIFY_OIDC_TOKEN`. For a signed-in feed, set `VERIFY_FEED_COOKIE`. The Playwright pass uses `domcontentloaded` / `load` (never `networkidle`) and ignores `net::ERR_ABORTED` from source switches.

The Lambda is 10 GB RAM, 15 minute timeout, 5 GB ephemeral disk, Node.js 22 + ffmpeg layer. Output is 1080-wide H.264 at ~5 Mbps / 30 fps with `+faststart`, plus a poster JPG.

## Transcode webhook secret (SSM)

```bash
SECRET="$(openssl rand -hex 32)"
aws ssm put-parameter \
  --name /volleyball-clips/transcode-webhook-secret \
  --description "HMAC secret for volleyball-clips transcode webhook" \
  --type SecureString \
  --value "$SECRET" \
  --region us-east-2
```

The stack output `TRANSCODE_WEBHOOK_SECRET_PARAMETER` is that name. Do not put the decrypted secret in CloudFormation.

## AI tagging

When a clip’s 1080p playback copy is ready, the transcode Lambda sends `{ clipId, playbackKey }` to an SQS queue. A second Lambda (reserved concurrency 2, batch size 1) downloads that playback file from S3, uploads it to the Gemini File API (`media_resolution` low, JSON schema), writes `clip_ai_tags`, maps the result onto the existing tag catalog, and deletes the Gemini file. After 3 receives, the message goes to a dead-letter queue. Re-tagging a clip overwrites its AI row. For unlocked clips it also **replaces** `clip_tags` (delete existing rows for that clip, then insert the mapped set — not a merge). It does **not** change `clip_tags` after an admin has saved tags on the per-clip edit page (`clips.tags_locked`). Every existing clip starts unlocked so the first backfill retags them all.

Gemini model: `gemini-3.8-flash`. Prompt and schema live in `src/lib/ai-tags.ts`.

### What you need to set (once)

Create two SSM SecureStrings in `us-east-2`. CloudFormation cannot store the values.

```bash
# Gemini API key
aws ssm put-parameter \
  --name /volleyball-clips/gemini-api-key \
  --description "Gemini API key for volleyball-clips AI tagging" \
  --type SecureString \
  --value "$GEMINI_API_KEY" \
  --region us-east-2

# Neon pooled URL the tagging Lambda uses (same DATABASE_URL as the app)
aws ssm put-parameter \
  --name /volleyball-clips/database-url \
  --description "Neon pooled DATABASE_URL for volleyball-clips AI tagging Lambda" \
  --type SecureString \
  --value "$DATABASE_URL" \
  --region us-east-2
```

IAM (the CDK stack grants these; you do not add them by hand):

| Principal | Permission |
| --- | --- |
| Transcode Lambda | `sqs:SendMessage` on the AI tag queue |
| AI tag Lambda | `s3:GetObject` on `playback/*`; `ssm:GetParameter` on `/volleyball-clips/gemini-api-key` and `/volleyball-clips/database-url`; SQS consume on the tag queue |
| Your deploy/backfill user | existing CDK deploy rights, plus `sqs:SendMessage` on the tag queue to run the backfill |

Do **not** put `GEMINI_API_KEY` or the database URL on Vercel. The Next.js app only reads `clip_ai_tags`.

Apply the Drizzle migration (`clip_ai_tags` + `clips.tags_locked` defaulting to false) yourself when you are ready. Existing clips stay unlocked so the first backfill replaces their current tags:

```bash
pnpm db:migrate   # DATABASE_URL_UNPOOLED, production only from your machine
pnpm db:seed      # adds the funny tag if it is missing
```

### Deploy the queue, DLQ, and tagging Lambda

Do not deploy from a coding agent. From a machine with AWS credentials, after the two SSM parameters exist:

```bash
cd infra
pnpm install
./scripts/prepare-ffmpeg-layer.sh
./scripts/prepare-lambda-deps.sh
npx cdk deploy \
  -c webhookUrl=https://<app-host>/api/webhooks/transcode \
  -c allowedOrigins=http://localhost:3000,https://<app-host> \
  -c cloudfrontPublicKeyPath=./keys/cloudfront-public.pem \
  -c lockUploads=true \
  -c lockPlayback=false
```

Or `cd infra && pnpm deploy` (same ffmpeg + lambda-deps prepare, then `cdk deploy --all`). You still need the CloudFront public-key context flags.

New stack outputs: `AI_TAG_QUEUE_URL`, `AI_TAG_DLQ_URL`, `AI_TAG_FUNCTION_NAME`, `GEMINI_API_KEY_PARAMETER`, `DATABASE_URL_PARAMETER`.

Copy `AI_TAG_QUEUE_URL` into the environment of the machine that will run the backfill (`.env.local` is fine). The transcode Lambda receives the queue URL from the stack; you do not set it on Vercel.

### Backfill existing ready clips

About 195 clips already have playback copies and no AI row. After CDK deploy + the migration, enqueue them. The tagging Lambda replaces each unlocked clip’s `clip_tags` with the mapped AI set:

```bash
# See what would be queued (no AWS send)
pnpm ai-tags:enqueue -- --dry-run

# Enqueue ready clips that have no clip_ai_tags row
pnpm ai-tags:enqueue

# Also re-queue failed rows, and pending rows stuck for 15+ minutes
pnpm ai-tags:enqueue -- --retry-failed --retry-stuck
```

Needs `DATABASE_URL` or `DATABASE_URL_UNPOOLED`, `AI_TAG_QUEUE_URL`, and AWS credentials that can `sqs:SendMessage` (same profile you use for `cdk deploy`).

Watch the queue and DLQ in the AWS console. The tagging Lambda logs are on `/aws/lambda/<AI_TAG_FUNCTION_NAME>`.

### Local dry-run (mocked Gemini)

```bash
# Any file works; the mock does not inspect the bytes
pnpm ai-tags:dry-run -- --file ./README.md
```

`--locked` checks that catalog tags are left alone. `--live` calls real Gemini and needs `GEMINI_API_KEY` locally. Do not commit that key.

Unit tests for mapping + the mocked pipeline: `pnpm test`.

## Vercel

- Framework: Next.js. Install `pnpm install`, build `pnpm build`.
- Git-linked. Enable OIDC. Team slug: `focus-otters-projects`.
- Set `AWS_REGION=us-east-2`.
- Add the Stripe test vars when you have them. The preview will boot without them.
- Add the production origin to Auth0 callbacks and to `allowedOrigins` on the stack.

## Analytics

The root layout loads [`@vercel/analytics`](https://vercel.com/docs/analytics) and [`@vercel/speed-insights`](https://vercel.com/docs/speed-insights).

**Turn them on in the Vercel dashboard** (Hobby can do this):

1. Project → **Analytics** → Enable. After the next deploy, page views show under Analytics.
2. Project → **Speed Insights** → Enable. Web Vitals show there.

This project stays on **Hobby**. Page views work on Hobby. Custom `track()` events **only appear on the Pro plan** (Analytics → custom events). The calls are already in the app so they light up if the plan changes. They are fire-and-forget: nothing in the product waits on them, and a failed or ignored call on Hobby does not error.

| Event | When | Where |
| --- | --- | --- |
| `clip_view` | Active clip in the feed changes (throttled). Props: `clip_id`, `game_id` | Client |
| `favorite` | Heart succeeds. Prop: `clip_id` | Client |
| `download_success` | A new row is written to `download_events`. Props: `quality`, `tier` | Server |
| `download_limit_hit` | Free weekly cap, from the download button | Client |
| `watch_limit_hit` | Guest hits the 7-a-day wall | Server |
| `signup_click` | Create-account / sign-in-to-favorite / sign-in-to-download | Client |
| `sign_in_click` | Sign in | Client |
| `go_pro_click` | Pricing links and Pay $5 | Client |
| `checkout_started` | Stripe Checkout URL is in hand | Client |
| `checkout_success` | `/pricing?checkout=success` | Server |

**Hobby source of truth** (already in Neon, no Vercel plan needed):

- `watch_events` — guest clip views and the 7-a-day wall
- `download_events` — downloads (`quality` is `playback` or `original`)
- `users.subscription_status` (plus `current_period_end`) — Pro / checkout state from Stripe webhooks

Facebook gym links should keep `?utm_source=facebook&utm_campaign=<gym>` on the first page. Auth returnTo and in-feed URL updates copy `utm_*` so a later sign-in does not drop them. Vercel records those query params on the landing page view. UTM **breakdowns** in the dashboard need Web Analytics Plus; the raw landing URL still has them.

Share previews: `metadataBase` is `https://vbpov.com`. Session and clip pages expose Open Graph + Twitter tags (and a 1200×630 `opengraph-image`) without auth. The 7-a-day wall is client-side after `/api/watch`; Facebook’s crawler reads the HTML head.

## Admin upload notes

On a phone, the admin session page’s file input opens the camera roll (`accept="video/*"`, `multiple`). Files upload in parallel (3 at a time). Pin clips on the same page. Edit tags (and delete) on each clip’s page. AI tags land after playback is ready.

Public visitors only see clips in `ready`.

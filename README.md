# VB POV

Vertical Meta-glasses volleyball clips for Focus ([vbpov.com](https://vbpov.com)). Public visitors pick a night, open a session grid, then swipe a TikTok-style 9:16 feed. Signed-in viewers can favorite clips and download. Pro ($5/month, Stripe test mode) unlocks unlimited original-quality downloads. Admin is the Auth0 role `admin` on the claim `https://vbpov.com/roles`.

## Features

- **Nights:** month calendar (`?ym=YYYY-MM&d=YYYY-MM-DD`) lists that day’s sessions (venue, time, type: open gym, league, tournament).
- **Session grid:** every ready clip, pins first. Optional pin labels: Longest rally, Best dig, Super spike. Each label at most once per session, max 3 pins.
- **Feed:** tap a clip for a full-screen vertical swipe feed starting on that clip. Deep link `/games/{id}/watch/{clipId}`. Tag filter is respected. Active clip autoplays; neighbors preload. Close returns to the grid.
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

Hallmark is used for craft (tokens, type scale, spacing, focus, reduced motion). The look is original: a dark, loud, mobile-first night court. Inspo references that informed it (not cloned):

- **General Condition** (dark / loud / mobile): electric red on a dark media grid → accent + poster rail
- **Beard Meats Food** (podcast): chunky high-contrast type on charcoal → display size and night paper
- **Artek** pricing: featured / warm block → Pro card
- **Audius** pricing: simple dark stacks → Guest and Free
- **Audocph** pricing: highlighted strip → originals callout

Tokens live in `src/app/tokens.css`. Display is Tektur, body is Onest. Paper is a red-tinted night (`oklch(16% 0.018 18)`), accent is electric red used as a fill on actions, spark lime is reserved for pins and Pro.

## Architecture

```
phone / laptop
   │
   ├─ public Next.js pages ── Neon (venues, games/sessions, clips, tags, pins, users, favorites, watch/download events)
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
                                    │
                                    └─ CloudFront (OAC)
                                          playback + posters inline
                                          uploads/* as Content-Disposition: attachment
```

- **App:** Next.js App Router on Vercel, TypeScript, Tailwind v4, pnpm.
- **DB:** Neon Postgres, Drizzle schema in `src/lib/db/schema.ts`.
- **Auth:** `@auth0/nextjs-auth0` v4. Viewer sign-up is on. Admin is `isAdmin()` in `src/lib/roles.ts`.
- **AWS (us-east-2, tag `project=volleyball-clips`):** private S3 bucket, CloudFront with origin access control, transcode Lambda, IAM role for Vercel OIDC.

S3 keys:

| Prefix | Purpose |
| --- | --- |
| `uploads/{gameId}/{clipId}/…` | Original glasses file (Pro download) |
| `playback/{gameId}/{clipId}/playback.mp4` | 1080-wide H.264 ~5 Mbps / 30 fps, faststart (feed + free download) |
| `posters/{gameId}/{clipId}/poster.jpg` | Still for the grid and player |

Public playback uses `cdnUrl()`. Free downloads never serve `uploads/`.

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

## Auth model

`isAdmin(user)` reads `user["https://vbpov.com/roles"]` and returns true only when that list includes `admin`. Reuse it everywhere. `requireAdminPage` / `requireAdminApi` and `src/proxy.ts` send signed-in non-admins to `/not-authorized` (or 403 on APIs).

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
| `STRIPE_SECRET_KEY` | Stripe **test** secret (`sk_test_…`). Optional; app degrades without it |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. Optional |
| `STRIPE_PRICE_ID` | Recurring $5/month test price. Optional |

### From `VolleyballClipsStack` outputs

| Output / env var | Used for |
| --- | --- |
| `AWS_REGION` | Always `us-east-2` |
| `AWS_S3_BUCKET` | Bucket name for presigned PUTs |
| `AWS_ROLE_ARN` | Vercel OIDC role |
| `NEXT_PUBLIC_CDN_URL` | `https://<cloudfront-domain>` for playback, posters, and original downloads |
| `TRANSCODE_WEBHOOK_SECRET_PARAMETER` | Name of the SSM SecureString |

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
6. Enable the Customer Portal in Stripe for cancel and card updates.

One more thing: if you will charge US or EU customers later, consider [Stripe Tax for recurring payments](https://docs.stripe.com/billing/taxes/collect-taxes). This app does not enable `automatic_tax`.

## Neon

1. Create a project (region close to `us-east-2` is fine).
2. Copy pooled and direct URLs into `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. For schema experiments, **create a branch** and migrate that. Do not migrate production from an agent.
4. `pnpm db:migrate` then optionally `pnpm db:seed`.

## Auth0

1. Regular Web Application on `vb-pov.us.auth0.com`.
2. Allowed Callback URLs: `http://localhost:3000/auth/callback` and `https://<app-host>/auth/callback`.
3. Allowed Logout URLs: `http://localhost:3000` and `https://<app-host>`.
4. Allowed Web Origins: the same two origins.
5. Enable Database + Google sign-up. Facebook can wait.
6. Role `admin` + Post-Login Action (above) for the namespaced roles claim.
7. v4 routes: `/auth/login`, `/auth/callback`, `/auth/logout`. Sign-up: `/auth/login?screen_hint=signup`.

## CDK deploy

Do not deploy this stack from a coding agent. Focus’s bot deploys AWS. From a machine with AWS credentials:

```bash
cd infra
pnpm install
./scripts/prepare-ffmpeg-layer.sh
npx cdk deploy \
  -c webhookUrl=https://<app-host>/api/webhooks/transcode \
  -c allowedOrigins=http://localhost:3000,https://<app-host>
```

Useful context flags: `webhookUrl`, `allowedOrigins`, `vercelTeamSlug` (`focus-otters-projects`), `vercelProjectName` (`volleyball-clips`), `vercelOidcProviderArn`.

The stack is `VolleyballClipsStack` in `us-east-2`. Every resource is tagged `project=volleyball-clips`.

After deploy, set `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ROLE_ARN`, `NEXT_PUBLIC_CDN_URL`, and `TRANSCODE_WEBHOOK_SECRET` on Vercel.

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

## Vercel

- Framework: Next.js. Install `pnpm install`, build `pnpm build`.
- Git-linked. Enable OIDC. Team slug: `focus-otters-projects`.
- Set `AWS_REGION=us-east-2`.
- Add the Stripe test vars when you have them. The preview will boot without them.
- Add the production origin to Auth0 callbacks and to `allowedOrigins` on the stack.

## Admin upload notes

On a phone, the admin session page’s file input opens the camera roll (`accept="video/*"`, `multiple`). Files upload in parallel (3 at a time). Tag and pin clips on the same page.

Public visitors only see clips in `ready`.

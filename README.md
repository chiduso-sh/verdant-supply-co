# Verdant Supply Co.

A small e-commerce demo: product catalogue, cart, Google sign-in, a checkout
that persists orders to Neon Postgres, and a confirmation email — plus an
**Expo mobile app** (`mobile/`) that signs into the same account and shares the
same cart live.

Built as an HNG assessment task. **No payment is processed** — see
[Scope](#scope) below.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript | Server actions and OAuth callbacks live in one deployable |
| Styling | Tailwind CSS v4 | No component-library install churn |
| Database | Neon Postgres + Drizzle ORM | Serverless HTTP driver, typed schema, `drizzle-kit push` |
| Auth | Auth.js v5 (`next-auth@5` beta) + Google, database sessions | Google-only, as specified |
| Email | Brevo HTTP API | See [Why Brevo](#why-brevo) |
| Mobile | Expo (React Native), React Navigation | Runs in Expo Go on a real phone with no native build |
| Mobile auth | Device-pairing grant (RFC 8628 shape) | Reuses the website's Google session; no second OAuth client, no extra redirect URI |
| Cart sync | Server cart + SSE (web) / 2s polling (mobile) | Sub-two-second sync with no realtime vendor — see [Cart sync](#cart-sync) |

## Setup

### 1. Install

```bash
npm install
```

### 2. Create the three external resources

Copy `.env.example` to `.env.local` and fill it in as you go.

**Neon** — create a project at [neon.tech](https://neon.tech) and copy the
**pooled** connection string (the host contains `-pooler`) into `DATABASE_URL`.

**Google OAuth** — in the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Create a project, then configure the OAuth consent screen (User type:
   **External**, publishing status **Testing** is fine).
2. Credentials → Create credentials → **OAuth client ID** → **Web application**.
3. Under **Authorized redirect URIs**, add exactly:
   `http://localhost:3000/api/auth/callback/google`
4. Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

**Brevo** — sign up at [brevo.com](https://www.brevo.com), create an API key
(SMTP & API → API keys) for `BREVO_API_KEY`, then add your own address as a
sender (Senders → Add a sender) and click the verification link Brevo emails
you. Put that same address in `BREVO_SENDER_EMAIL`.

**Auth secret** — generate one:

```bash
npx auth secret
```

### 3. Create the tables and seed the catalogue

```bash
npm run db:push
```

```bash
npm run db:seed
```

`db:push` diffs `lib/db/schema.ts` straight against Neon — there are no
migration files, which is a deliberate trade for a demo of this size. `db:seed`
upserts 12 products by slug, so it is safe to re-run.

### 4. Run

```bash
npm run dev
```

### 5. The mobile app (optional)

```bash
cd mobile && npm install && npm start
```

Full instructions, including how to point it at a local server and how to test
on a real phone, are in [`mobile/README.md`](mobile/README.md).

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build (needs `DATABASE_URL` set — see note below) |
| `npm test` | Unit tests (`node:test`, no extra framework) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push the schema to Neon |
| `npm run db:seed` | Upsert the product catalogue |

The mobile app has its own install and scripts; see
[`mobile/README.md`](mobile/README.md).

## Architecture notes

**Money is always integer cents.** `price_cents`, `unit_price_cents` and
`subtotal_cents` are all `integer`. No float touches a price anywhere, and
`formatCents` is the only thing that divides by 100.

**The cart lives on the server once you are signed in, and in `localStorage`
before that.** Either way the server does not trust it: a cart line is a
product id and a quantity and nothing else. At checkout the server re-reads
every price from the database and takes *only* the quantity from the client,
so a tampered cart cannot set a price. See `buildOrderItems` in
`lib/checkout.ts` — no price ever reaches it from the browser or the app.

**The recipient address comes from the session, not the form.** A confirmation
email can only ever go to the signed-in Google account's address.

**Order and items are written atomically.** `db.batch()` on the Neon HTTP
driver runs both inserts in a single transaction, so an order can never be
persisted without its items. The order id is generated in application code
rather than by the database precisely so both inserts can go in one batch.

**Email is sent after the write and outside it.** `sendOrderConfirmation` never
throws; a failure is logged and the order still succeeds. Losing a customer's
order because a mail provider was down would be the worse bug.

**Order ownership is in the `WHERE` clause.** `/orders/[id]` filters on
`userId` as part of the query rather than checking after fetching, so guessing
an order id returns 404 instead of someone else's shipping address.

**Pure logic is separated from I/O.** `lib/cart.ts`, `lib/cart-merge.ts`,
`lib/checkout.ts`, `lib/geo.ts`, `lib/money.ts`, `lib/order-number.ts`,
`lib/tokens.ts` and `lib/email-template.ts` have no database, network or
`window` access, which is what makes them unit testable — and what lets the
mobile app import several of them directly (see [The mobile app](#the-mobile-app)).

**The web server action and the HTTP API share one implementation.**
`app/checkout/actions.ts` and `POST /api/orders` are both thin wrappers over
`createOrder` in `lib/server/orders.ts`. A server action is an RPC protocol
tied to a build-specific action id, so a native client cannot call one; the API
exists alongside it rather than replacing it, and sharing the core is what
stops web and mobile drifting apart on what an order costs.

**Steppers send a delta, not an absolute quantity.** `adjust(productId, delta)`
resolves against a ref that is updated synchronously, not against the quantity
the last render saw. Two taps landing in one React batch would otherwise both
compute from the same stale number and the second would be silently lost.

### A note on `npm run build`

`DATABASE_URL` must be present at build time, not just at runtime, because
`@auth/drizzle-adapter` inspects the Drizzle client at module load to determine
its dialect — so the client cannot be constructed lazily. Set it in Vercel's
environment variables as well as locally. Nothing connects during the build;
the HTTP driver only opens a connection when a query runs.

## The HTTP API

The website's pages are server components that query Drizzle directly, and its
checkout is a server action. Neither is reachable from a native client, so
there is a parallel HTTP surface under `app/api/`. It is the *only* thing the
mobile app talks to.

Every route is a few lines over a module in `lib/server/`, with the shared
plumbing — JSON shape, error shape, auth, CORS, preflight — in
`lib/server/http.ts` so no route can forget a piece of it.

| Route | Methods | Auth | Notes |
| --- | --- | --- | --- |
| `/api/products` | GET | public | `?grouped=1` for shop-front ordering |
| `/api/products/[slug]` | GET | public | |
| `/api/me` | GET | required | Also reports which credential was used |
| `/api/cart` | GET, PUT, DELETE | required | `PUT` replaces the whole cart |
| `/api/cart/items` | POST | required | Add/increment one product |
| `/api/cart/items/[productId]` | PATCH, DELETE | required | Absolute quantity; `0` removes |
| `/api/cart/merge` | POST | required | Fold a local cart up — the `localStorage` migration path |
| `/api/cart/version` | GET | required | Single indexed row read; what mobile polls |
| `/api/cart/stream` | GET | cookie | Server-sent events; what the web subscribes to |
| `/api/orders` | GET, POST | required | `POST` with no `lines` buys the server cart |
| `/api/orders/[id]` | GET | required | Ownership is in the `WHERE` clause |
| `/api/auth/device` | POST | public | Open a pairing |
| `/api/auth/device/token` | POST | pairing | Poll, then exchange once for a token |
| `/api/auth/device/signout` | GET, POST | required | List and revoke paired devices |

**Errors are always `{ "error": string, "code"?: string }`**, with a message
written to be shown to a person — both clients render it directly rather than
mapping status codes to their own copy. An unexpected exception is logged in
full server-side and reduced to a bare 500 on the wire.

**CORS uses a wildcard origin and never sends `Access-Control-Allow-Credentials`.**
That combination is safe: without the credentials header a browser will not
attach the session cookie to a cross-origin request and will not let the
calling page read the response, so the only way to authenticate from another
origin is a bearer token an attacker has no way to obtain. The headers exist
for Expo's web target during development — React Native's `fetch` is not
subject to CORS at all. **If this ever needs `Allow-Credentials`, the wildcard
must become an explicit allowlist in the same commit.**

## Mobile authentication

A native app cannot hold Auth.js's HTTP-only session cookie, so it carries a
bearer token from the `api_token` table instead. Both credentials resolve to a
row in `user` — there is no parallel user concept — which is what makes "the
same account on both" literally rather than approximately true.

Getting the token uses the device-authorization grant (RFC 8628's shape):

1. The app calls `POST /api/auth/device` and gets a secret `deviceCode` plus a
   readable eight-character `userCode`.
2. It shows the `userCode` and polls `POST /api/auth/device/token`.
3. The person opens `/link` in any browser, signs in with Google as normal, and
   types the code. A server action approves it.
4. The next poll returns the bearer token. The exchange is single-use.

**Why this rather than native Google Sign-In.** The phone never touches Google
credentials, no second OAuth client is needed, and — the part that actually
saves time — no new authorized redirect URI has to be registered for every
origin the app is served from. That last one is the usual reason device login
fails while desktop works.

Tokens are stored only as a SHA-256 hash, so a database dump yields nothing
usable. Sign-out stamps `revoked_at` rather than deleting, so a revoked token
stays distinguishable from one that never existed. Pairing codes use rejection
sampling rather than `orderNumberFromBytes`, whose modulo bias is harmless for
an order reference and not harmless for something an attacker would like to
guess.

## Cart sync

Signing in moves the cart to `cart` / `cart_item`. Anonymous visitors keep a
`localStorage` cart — requiring an account to put a plant in a basket would be
a worse trade than the sync it buys.

**The `cart.version` column is the whole mechanism.** Every mutation bumps it
through one shared statement, so a client can ask "has anything changed?" with
a single primary-key read instead of diffing an item list.

- **Web** subscribes to `/api/cart/stream`, which polls that column server-side
  and emits an event when it moves.
- **Mobile** polls `/api/cart/version` every two seconds while in the
  foreground. It does not stream because React Native's `EventSource` cannot
  attach an `Authorization` header.

**"Instantly" means under about two seconds, not microseconds.** True push
would need a realtime provider (Pusher, Ably, Supabase Realtime) because
Vercel's serverless functions cannot hold a websocket — a new vendor and a new
set of credentials. That trade was made in favour of no new dependency. The SSE
connection also closes itself just under the platform's function limit and the
browser reconnects, so clients treat a close as routine.

Both clients apply edits optimistically and then adopt the server's response,
dropping any payload whose `version` is below the highest already applied — so
a slow response for an older version cannot flicker a stale cart back onto the
screen.

### The localStorage migration

The first time a browser loads signed in after this deploy it is holding a cart
the server has never seen. It posts it to `/api/cart/merge` and adopts the
result.

**The merge rule is union, resolving a shared product to the larger quantity**
(`mergeCarts` in `lib/cart-merge.ts`). Union because losing an item someone
picked out is the one outcome worse than a wrong quantity. *Larger* rather than
*sum* because the common case is one person who added the same thing on their
phone and their laptop and wants one of it, not two.

Two details that are load-bearing rather than incidental:

- **The anonymous key is deleted once merged**, and that deletion *is* the
  "already migrated" marker. Without it, a line deleted on another device would
  be resurrected from this browser's stale copy on the next cold start.
- **A signed-in user's offline cache lives under a user-scoped key**
  (`verdant.cart.v1:<userId>`). Sharing one key would merge one person's cart
  into the next person's on a shared browser.

A merge that changes nothing does not write, so signing in on a third device
does not bump the version and wake every other client for no reason.

## The mobile app

Expo + React Native, in `mobile/`. See [`mobile/README.md`](mobile/README.md)
for how to run it and for the physical-device test script.

**It shares the web project's pure modules rather than copying them.**
`metro.config.js` maps `@shop/*` to `../lib/*`, so the app imports `lib/cart.ts`
(cart maths for optimistic edits), `lib/money.ts` (`formatCents`) and
`lib/geo.ts` (the country/region/city cascade in checkout) directly. Those three
have no imports at all — no React, no database, no `window` — which is what
makes it possible. Hierarchical module lookup is disabled so a shared module
cannot reach up into the Next.js app's copy of React.

**Pricing is not shared because it is not duplicated.** The app never computes a
total; the server does, and the app renders what the API returns.

## Why Brevo

Resend and Mailgun both gate sending on **domain verification**, not on plan
tier. Without a verified domain, Resend delivers only to the account owner's
own address, and Mailgun's sandbox only to up to five recipients who each have
to click an activation link. Upgrading does not lift either restriction.

Brevo verifies a **sender address** instead — click a link in your own inbox —
and then sends to any recipient, on a permanent free tier with no card. It is
also an HTTP API rather than SMTP, which matters on serverless where a
connection cannot be kept warm between invocations.

`sendOrderConfirmation` takes injectable `fetchImpl` and `env`, so swapping
providers means changing one function.

## Tests

```bash
npm test
```

229 unit tests across the pure logic:

| File | Covers |
| --- | --- |
| `tests/money.test.ts` | Currency formatting, including negatives and float-artefact regressions |
| `tests/cart.test.ts` | Add/merge/cap/remove, quantity clamping, and parsing hostile or stale `localStorage` |
| `tests/checkout.test.ts` | Address validation, duplicate-line collapsing, rejection of malformed quantities, and the invariant that prices come only from the database |
| `tests/order-number.test.ts` | Byte-to-alphabet mapping, shape, and the exclusion of ambiguous characters |
| `tests/email-template.test.ts` | HTML escaping and XSS, greeting fallbacks, totals, Brevo payload shape |
| `tests/email.test.ts` | Request shape and headers, missing config, 4xx/5xx handling, network failure — asserting it never throws |
| `tests/geo.test.ts` | Country list construction, the region and city cascade, unknown-country handling |
| `tests/cart-merge.test.ts` | The union/max merge rule, every strategy, normalization of hostile input, idempotence |
| `tests/tokens.test.ts` | Unbiased pairing-code sampling, code normalization, bearer parsing, SHA-256 hashing, expiry and single-use rules |

### What is not covered

Stated plainly rather than implied by a coverage number:

- **React components** have no tests. There is no DOM test environment
  configured; they are covered by `tsc` and a manual pass only.
- **The database write itself** (`db.batch` in `lib/server/orders.ts` and
  `lib/server/cart.ts`) is not tested. Every rule it applies is tested in
  `lib/checkout.ts` and `lib/cart-merge.ts`, but the inserts need a live Neon
  branch to exercise.
- **The route handlers** have no automated tests. They were exercised by hand
  against a live server — both credentials, cross-user access, price tampering,
  the merge path and a full checkout from each client — but none of that is
  codified. This is the biggest gap in the suite.
- **The Auth.js Google flow** is not tested; it needs real OAuth credentials.
- **The mobile app** has no tests. It is covered by `tsc` and a manual pass.

## Scope

Built: catalogue, product pages, cart, Google sign-in gate at checkout,
checkout with shipping address, atomic order persistence, confirmation email,
order success page, per-user order history — plus an HTTP API, a server-side
cart that syncs live across devices, bearer-token auth for native clients, and
an Expo mobile app covering catalogue, cart, checkout and orders.

Deliberately out of scope for the time budget: payment processing (never
requested), stock levels and overselling logic, shipping rates, tax, discount
codes, order statuses beyond `confirmed`, search and filtering, and a product
admin UI. The shipping address is collected and stored but not validated or
rated.

## Deploying to Vercel

1. Push to GitHub, import the repo in Vercel.
2. Add all of `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
   `AUTH_GOOGLE_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`,
   `BREVO_SENDER_NAME` as environment variables, and set `AUTH_URL` to the
   deployed origin.
3. **Add `https://<your-domain>/api/auth/callback/google` to the Google OAuth
   client's authorized redirect URIs.** Forgetting this is the classic reason
   sign-in works locally and fails in production.
4. Run `npm run db:push` against the production database so the `cart`,
   `cart_item`, `api_token` and `device_auth_request` tables exist. The app
   will 500 on any cart request without them.

`AUTH_URL` does double duty now: the device-pairing response uses it to build
the `/link` URL it tells a phone to open. Behind a proxy or a tunnel the
request's own origin can be an internal hostname the phone cannot reach, so
`AUTH_URL` is preferred over it. **Set it to the origin a phone's browser can
actually resolve.**

The mobile app is not deployed by Vercel — it is a separate Expo project. It
defaults to calling `https://verdant-supply-co.vercel.app`, so a build needs no
configuration to reach production.

### The `/api/cart/stream` function limit

The SSE route sets `maxDuration = 60` and closes itself at 55 seconds. On a
Vercel plan with a lower ceiling the connection will be cut earlier; that is
harmless — `EventSource` reconnects — but the route's own `MAX_STREAM_MS`
should be lowered to match so the close is graceful rather than a hard kill.

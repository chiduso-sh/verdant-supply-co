# Verdant Supply Co.

A small e-commerce demo: product catalogue, cart, Google sign-in, a checkout
that persists orders to Neon Postgres, and a confirmation email.

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

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build (needs `DATABASE_URL` set — see note below) |
| `npm test` | Unit tests (`node:test`, no extra framework) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push the schema to Neon |
| `npm run db:seed` | Upsert the product catalogue |

## Architecture notes

**Money is always integer cents.** `price_cents`, `unit_price_cents` and
`subtotal_cents` are all `integer`. No float touches a price anywhere, and
`formatCents` is the only thing that divides by 100.

**The cart lives in `localStorage`, and the server does not trust it.** The
client cart is a list of product ids and quantities. At checkout the server
re-reads every price from the database and takes *only* the quantity from the
client, so a tampered cart cannot set a price. See `buildOrderItems` in
`lib/checkout.ts` — no price ever reaches it from the browser.

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

**Pure logic is separated from I/O.** `lib/cart.ts`, `lib/checkout.ts`,
`lib/order-number.ts` and `lib/email-template.ts` have no database, network or
`window` access, which is what makes them unit testable.

### A note on `npm run build`

`DATABASE_URL` must be present at build time, not just at runtime, because
`@auth/drizzle-adapter` inspects the Drizzle client at module load to determine
its dialect — so the client cannot be constructed lazily. Set it in Vercel's
environment variables as well as locally. Nothing connects during the build;
the HTTP driver only opens a connection when a query runs.

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

129 unit tests across the pure logic:

| File | Covers |
| --- | --- |
| `tests/money.test.ts` | Currency formatting, including negatives and float-artefact regressions |
| `tests/cart.test.ts` | Add/merge/cap/remove, quantity clamping, and parsing hostile or stale `localStorage` |
| `tests/checkout.test.ts` | Address validation, duplicate-line collapsing, rejection of malformed quantities, and the invariant that prices come only from the database |
| `tests/order-number.test.ts` | Byte-to-alphabet mapping, shape, and the exclusion of ambiguous characters |
| `tests/email-template.test.ts` | HTML escaping and XSS, greeting fallbacks, totals, Brevo payload shape |
| `tests/email.test.ts` | Request shape and headers, missing config, 4xx/5xx handling, network failure — asserting it never throws |

### What is not covered

Stated plainly rather than implied by a coverage number:

- **React components** have no tests. There is no DOM test environment
  configured; they are covered by `tsc` and a manual pass only.
- **The database write itself** (`db.batch` in `app/checkout/actions.ts`) is not
  tested. Every rule it applies is tested in `lib/checkout.ts`, but the insert
  needs a live Neon branch to exercise.
- **The Auth.js Google flow** is not tested; it needs real OAuth credentials.

## Scope

Built: catalogue, product pages, cart, Google sign-in gate at checkout,
checkout with shipping address, atomic order persistence, confirmation email,
order success page, per-user order history.

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

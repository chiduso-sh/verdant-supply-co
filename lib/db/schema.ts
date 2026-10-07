import {
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* ---------- Auth.js tables (shapes required by @auth/drizzle-adapter) ---------- */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* ---------- Shop tables ---------- */

export const products = pgTable("product", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  // Money is ALWAYS integer cents. Never a float, never a string.
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orders = pgTable("order", {
  // Generated in app code so order + items can go in one atomic db.batch().
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  // Snapshot of the recipient at purchase time, taken from the session.
  email: text("email").notNull(),
  status: text("status").notNull().default("confirmed"),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingFullName: text("shipping_full_name").notNull(),
  shippingLine1: text("shipping_line1").notNull(),
  shippingLine2: text("shipping_line2"),
  shippingCity: text("shipping_city").notNull(),
  shippingState: text("shipping_state").notNull(),
  shippingPostalCode: text("shipping_postal_code").notNull(),
  shippingCountry: text("shipping_country").notNull(),
  shippingPhone: text("shipping_phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderItems = pgTable("order_item", {
  id: serial("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  // Name and price are snapshotted: editing a product later must not
  // retroactively rewrite what someone was charged.
  nameSnapshot: text("name_snapshot").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
});

export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

/* ---------- Server-side cart ---------- */

/**
 * One cart per signed-in user.
 *
 * `version` is the whole point of this table: it is bumped on every mutation
 * so a second device can ask "has anything changed since N?" with a single
 * indexed row read instead of diffing the item list. Anonymous visitors have
 * no row here — their cart stays in localStorage until they sign in, and is
 * merged up at that point (see lib/cart-merge.ts).
 */
export const carts = pgTable("cart", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Cart lines. Quantity is the only thing the client gets to decide — name,
 * price and image are read back from `product` on every GET, so a stale or
 * tampered client cannot influence what anything costs.
 */
export const cartItems = pgTable(
  "cart_item",
  {
    userId: text("user_id")
      .notNull()
      .references(() => carts.userId, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
  },
  (item) => [primaryKey({ columns: [item.userId, item.productId] })],
);

/* ---------- Mobile auth ---------- */

/**
 * Bearer tokens for native clients.
 *
 * The web app authenticates with an HTTP-only cookie, which a native app
 * cannot hold. These tokens are the native equivalent. Only a SHA-256 hash is
 * stored: a leaked database dump must not yield usable credentials. Rows are
 * never deleted on sign-out, only stamped `revokedAt`, so a revoked token is
 * distinguishable from one that never existed.
 */
export const apiTokens = pgTable("api_token", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Free-text device label, shown when listing active sessions.
  deviceName: text("device_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/**
 * In-flight device pairings (the RFC 8628 device-authorization shape).
 *
 * The app asks for a pairing, shows the user a short code, and polls. The user
 * approves it in a browser where the normal Google cookie session already
 * works — so the phone never handles Google credentials and no new OAuth
 * redirect URI is needed. Both halves are stored hashed; `userCode` is the
 * only plaintext, and it is short-lived, single-use and rate-limited by its
 * own expiry.
 */
export const deviceAuthRequests = pgTable("device_auth_request", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  deviceCodeHash: text("device_code_hash").notNull().unique(),
  userCode: text("user_code").notNull().unique(),
  deviceName: text("device_name"),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  // Stamped when the app has exchanged this pairing for a token, so the
  // exchange can only happen once.
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  deniedAt: timestamp("denied_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type DeviceAuthRequest = typeof deviceAuthRequests.$inferSelect;

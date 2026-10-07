/**
 * The HTTP client. Every request the app makes goes through `request()`.
 *
 * There is no business logic here on purpose. The server computes every
 * total, validates every address and re-reads every price; this module's only
 * jobs are to attach the bearer token, turn a non-2xx into a typed error, and
 * hand back the JSON.
 */

import type { CartLine } from "@shop/cart";

/**
 * Where the API lives.
 *
 * Defaults to production, which is the pragmatic choice for testing on a real
 * phone: a device on a different network cannot reach a laptop's localhost,
 * and pointing the app at the deployed URL avoids a tunnel and the Google
 * redirect-URI registration a tunnel would drag in.
 *
 * Override with EXPO_PUBLIC_API_URL in mobile/.env to work against a local
 * server (see mobile/README.md).
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://verdant-supply-co.vercel.app"
).replace(/\/+$/, "");

export type ApiProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  category: string;
};

export type ServerCart = {
  version: number;
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  updatedAt: string | null;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  subtotalCents: number;
  createdAt: string;
};

export type OrderDetail = OrderSummary & {
  email: string;
  items: {
    id: number;
    productId: number;
    name: string;
    unitPriceCents: number;
    quantity: number;
  }[];
  addressLines: string[];
};

export type StartedPairing = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresAt: string;
  intervalSeconds: number;
};

export type Me = {
  user: { id: string; email: string | null; name: string | null };
  via: "bearer" | "cookie";
};

/** An HTTP failure with the server's own message, which is written for people. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the token is missing, expired or revoked: pair again. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** Aborts the request, for a screen that unmounts mid-flight. */
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;

  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // A network failure is the single most likely thing to go wrong on a
    // phone, so it gets its own message rather than surfacing "Network
    // request failed" to the user.
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    throw new ApiError(
      0,
      `Could not reach ${API_URL}. Check the connection and try again.`,
      "offline",
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string })
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? `Request failed (${response.status})`,
      payload?.code,
    );
  }

  if (payload === null) {
    throw new ApiError(response.status, "The server sent an empty response.");
  }

  return payload;
}

/* ---------- Catalogue (public) ---------- */

export async function fetchProducts(signal?: AbortSignal) {
  const { products } = await request<{ products: ApiProduct[] }>(
    "/api/products",
    { signal },
  );
  return products;
}

export async function fetchProduct(slug: string, signal?: AbortSignal) {
  const { product } = await request<{ product: ApiProduct }>(
    `/api/products/${encodeURIComponent(slug)}`,
    { signal },
  );
  return product;
}

/* ---------- Device pairing ---------- */

export function startPairing(deviceName: string) {
  return request<StartedPairing>("/api/auth/device", {
    method: "POST",
    body: { deviceName },
  });
}

export type PollResult =
  | { status: "pending"; intervalSeconds: number }
  | { status: "approved"; token: string; expiresAt: string };

/**
 * Polls a pairing once.
 *
 * 202 is "keep waiting" and comes back as a value; 403, 410 and 404 are real
 * endings and come back as a thrown ApiError, because the caller has to stop
 * polling and say something different for each.
 */
export async function pollPairing(deviceCode: string): Promise<PollResult> {
  return request<PollResult>("/api/auth/device/token", {
    method: "POST",
    body: { deviceCode },
  });
}

export function fetchMe(token: string, signal?: AbortSignal) {
  return request<Me>("/api/me", { token, signal });
}

export function signOutDevice(token: string) {
  return request<{ ok: boolean }>("/api/auth/device/signout", {
    method: "POST",
    token,
    body: {},
  });
}

/* ---------- Cart ---------- */

export async function fetchCart(token: string, signal?: AbortSignal) {
  const { cart } = await request<{ cart: ServerCart }>("/api/cart", {
    token,
    signal,
  });
  return cart;
}

export async function fetchCartVersion(token: string, signal?: AbortSignal) {
  const { version } = await request<{ version: number }>("/api/cart/version", {
    token,
    signal,
  });
  return version;
}

export async function addCartItem(
  token: string,
  productId: number,
  quantity = 1,
) {
  const { cart } = await request<{ cart: ServerCart }>("/api/cart/items", {
    method: "POST",
    token,
    body: { productId, quantity },
  });
  return cart;
}

export async function setCartItemQuantity(
  token: string,
  productId: number,
  quantity: number,
) {
  const { cart } = await request<{ cart: ServerCart }>(
    `/api/cart/items/${productId}`,
    { method: "PATCH", token, body: { quantity } },
  );
  return cart;
}

export async function removeCartItem(token: string, productId: number) {
  const { cart } = await request<{ cart: ServerCart }>(
    `/api/cart/items/${productId}`,
    { method: "DELETE", token },
  );
  return cart;
}

/* ---------- Orders ---------- */

export type ShippingBody = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

/**
 * Places an order from whatever is in the server cart.
 *
 * `lines` is deliberately not sent: the cart already lives on the server, and
 * resending the app's copy would only create a way for the two to disagree.
 */
export async function placeOrder(token: string, shipping: ShippingBody) {
  return request<{
    order: { id: string; orderNumber: string };
    emailSent: boolean;
  }>("/api/orders", { method: "POST", token, body: { shipping } });
}

export async function fetchOrders(token: string, signal?: AbortSignal) {
  const { orders } = await request<{ orders: OrderSummary[] }>("/api/orders", {
    token,
    signal,
  });
  return orders;
}

export async function fetchOrder(
  token: string,
  id: string,
  signal?: AbortSignal,
) {
  const { order } = await request<{ order: OrderDetail }>(
    `/api/orders/${encodeURIComponent(id)}`,
    { token, signal },
  );
  return order;
}

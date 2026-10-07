/**
 * Shared plumbing for the /api route handlers: JSON responses, a uniform
 * error shape, authentication, and CORS.
 *
 * Route handlers are meant to be three or four lines each. Everything they
 * have in common lives here so no route can forget a piece of it.
 */

import { CartError } from "@/lib/server/cart";
import { resolveCaller, type ApiCaller } from "@/lib/server/api-auth";

/**
 * CORS for the native client.
 *
 * A wildcard origin is safe *specifically because* `Access-Control-Allow-
 * Credentials` is never sent. Without it a browser will not attach the
 * Auth.js session cookie to a cross-origin request and will not let the
 * calling page read the response, so a hostile site gains nothing: the only
 * way to authenticate from another origin is a bearer token, which that site
 * has no way to obtain. React Native's fetch is not subject to CORS at all —
 * these headers exist for Expo's web target, which is how the app gets
 * exercised in a browser during development.
 *
 * If this ever needs `Allow-Credentials`, the wildcard has to become an
 * explicit origin allowlist at the same moment. The two are not independent.
 */
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

/** An error carrying the status it should become. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Carts and orders are per-user and change constantly. Nothing here is
      // ever safe for a shared cache.
      "cache-control": "no-store",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });
}

/**
 * One error shape for every route: `{ error: string, code?: string }`.
 *
 * The message is written to be shown to a person, because both clients do
 * exactly that rather than mapping status codes to their own copy.
 */
export function apiError(
  status: number,
  message: string,
  code?: string,
): Response {
  return json(code ? { error: message, code } : { error: message }, { status });
}

/** Preflight. Each route re-exports this so none of them can forget it. */
export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Resolves the caller or throws a 401.
 *
 * Throwing rather than returning null is what lets a handler read as a
 * straight line: `const caller = await requireCaller(request)` and then get
 * on with it, with `route()` below turning the throw into a response.
 */
export async function requireCaller(request: Request): Promise<ApiCaller> {
  const caller = await resolveCaller(request);
  if (!caller) {
    throw new ApiError(401, "You need to be signed in.", "unauthenticated");
  }
  return caller;
}

/**
 * Parses a JSON body, rejecting anything that is not a JSON object.
 *
 * An empty body is `{}` rather than an error: several routes have nothing
 * required in the body, and a client that sends none of it is not wrong.
 */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "That request body is not valid JSON.", "bad_json");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ApiError(
      400,
      "That request body should be a JSON object.",
      "bad_json",
    );
  }

  return parsed as Record<string, unknown>;
}

/**
 * Wraps a handler so thrown errors become responses.
 *
 * `ApiError` and `CartError` carry their own status. Anything else is a bug:
 * it is logged in full server-side and reduced to a bare 500 on the wire,
 * because an internal message is exactly the sort of thing that leaks a
 * schema or a connection string to whoever is poking at the API.
 */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return apiError(error.status, error.message, error.code);
      }
      if (error instanceof CartError) {
        return apiError(error.status, error.message);
      }

      console.error(`[api] ${request.method} ${request.url} failed:`, error);
      return apiError(500, "Something went wrong on our end.", "internal");
    }
  };
}

/* ---------- Body coercion ---------- */

/**
 * Reads a cart line array out of an untrusted body.
 *
 * Shape errors are rejected here rather than coerced, so a client sending the
 * wrong thing finds out immediately. The *values* are still re-validated
 * downstream — this only establishes that the body is the right shape.
 */
export function readQuantityLines(
  value: unknown,
  field = "lines",
): { productId: number; quantity: number }[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, `\`${field}\` should be an array.`, "bad_lines");
  }

  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ApiError(
        400,
        `Every entry in \`${field}\` should be an object.`,
        "bad_lines",
      );
    }

    const line = entry as Record<string, unknown>;
    if (
      !Number.isInteger(line.productId) ||
      !Number.isInteger(line.quantity)
    ) {
      throw new ApiError(
        400,
        `Every entry in \`${field}\` needs an integer productId and quantity.`,
        "bad_lines",
      );
    }

    return {
      productId: line.productId as number,
      quantity: line.quantity as number,
    };
  });
}

/** Parses a path parameter that has to be a positive integer. */
export function readIntParam(raw: string, field: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiError(400, `\`${field}\` should be a positive integer.`);
  }
  return parsed;
}

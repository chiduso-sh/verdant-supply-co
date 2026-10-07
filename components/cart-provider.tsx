"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addLine,
  cartCount,
  cartSubtotalCents,
  CART_STORAGE_KEY,
  parseStoredCart,
  removeLine,
  setLineQuantity,
  type CartLine,
  type NewCartLine,
} from "@/lib/cart";

export type { CartLine, NewCartLine } from "@/lib/cart";

/** Where the cart currently lives. */
export type CartSource = "local" | "server";

type CartContextValue = {
  lines: CartLine[];
  /** False until storage has been read, so SSR and first paint agree. */
  hydrated: boolean;
  count: number;
  subtotalCents: number;
  /** "server" once signed in; "local" for anonymous visitors. */
  source: CartSource;
  /** True while a write is in flight, for subtle UI feedback. */
  syncing: boolean;
  /** Set when the server rejected a write. Cleared on the next success. */
  error: string | null;
  add: (line: NewCartLine, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  /**
   * Nudges a quantity by a delta, resolved against the latest state rather
   * than whatever a component last rendered. Steppers must use this: two
   * clicks landing in one React batch would otherwise both compute from the
   * same stale number and the second would be lost.
   */
  adjust: (productId: number, delta: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Storage keys.
 *
 * The anonymous cart and a signed-in user's offline cache are deliberately
 * kept apart. If they shared a key, signing out of one account and into
 * another on the same browser would merge the first person's cart into the
 * second's — and a line deleted on another device would come back from this
 * browser's stale cache on the next cold start.
 *
 * The anonymous key doubles as the "not yet migrated" marker: it is deleted
 * the moment its contents have been merged up, so a merge happens exactly
 * once per browser per sign-in and deletions can never resurrect.
 */
const anonKey = () => CART_STORAGE_KEY;
const cacheKey = (userId: string) => `${CART_STORAGE_KEY}:${userId}`;

function readStorage(key: string): CartLine[] {
  try {
    return parseStoredCart(window.localStorage.getItem(key));
  } catch {
    // Private mode or blocked site data: start empty rather than crash.
    return [];
  }
}

function writeStorage(key: string, lines: CartLine[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(lines));
  } catch {
    // Nothing to do — the cart still works for this page view.
  }
}

function dropStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

type ServerCartPayload = {
  version: number;
  lines: CartLine[];
};

async function callApi(
  path: string,
  init?: RequestInit,
): Promise<ServerCartPayload> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as
    | { cart?: ServerCartPayload; error?: string }
    | null;

  if (!response.ok || !body?.cart) {
    throw new Error(body?.error ?? `Cart request failed (${response.status})`);
  }

  return body.cart;
}

/**
 * The cart.
 *
 * Two modes behind one interface:
 *
 * - **Anonymous** — localStorage only, exactly as before. No account, nothing
 *   to sync to, and no reason to make someone sign in to put a plant in a
 *   basket.
 * - **Signed in** — the server is the source of truth. Local edits apply
 *   optimistically so the UI never waits on a round trip, then the server's
 *   response replaces them. localStorage stays on as an offline cache so a
 *   reload shows something immediately instead of a skeleton.
 *
 * Changes made on another device arrive over SSE from /api/cart/stream.
 */
export function CartProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source: CartSource = userId ? "server" : "local";

  /**
   * The highest cart version this client has applied.
   *
   * Responses can land out of order — an SSE-triggered GET racing a mutation
   * it already knows about — so anything at or below this is dropped. Without
   * it, a slow response for an older version would flicker a stale cart back
   * onto the screen.
   */
  const version = useRef(0);
  const inFlight = useRef(0);

  /**
   * The current lines, updated synchronously on every change.
   *
   * `lines` state is only visible to the next render, which is too late for a
   * handler that fires twice before React re-renders. Anything that needs to
   * read "the quantity right now" reads this instead.
   */
  const linesRef = useRef<CartLine[]>([]);

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
  }, []);

  const applyServerCart = useCallback(
    (cart: ServerCartPayload) => {
      if (cart.version < version.current) return;
      version.current = cart.version;
      commit(cart.lines);
      if (userId) writeStorage(cacheKey(userId), cart.lines);
    },
    [userId, commit],
  );

  /** Wraps a server write: optimistic state is already applied by the caller. */
  const push = useCallback(
    async (run: () => Promise<ServerCartPayload>) => {
      inFlight.current += 1;
      setSyncing(true);
      try {
        applyServerCart(await run());
        setError(null);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not reach the cart. Try again.",
        );
        // Re-read the truth rather than leaving the optimistic edit standing.
        try {
          applyServerCart(await callApi("/api/cart"));
        } catch {
          // Offline. Keep what is on screen; the next event will reconcile.
        }
      } finally {
        inFlight.current -= 1;
        if (inFlight.current === 0) setSyncing(false);
      }
    },
    [applyServerCart],
  );

  /* ---------- Hydration ---------- */

  useEffect(() => {
    let cancelled = false;

    // The version counter belongs to one account's cart. Signing out and back
    // in — or into a different account — starts a fresh sequence that may well
    // be numbered lower, and a stale high-water mark would reject all of it.
    version.current = 0;

    // Anonymous: localStorage is the whole story.
    if (!userId) {
      commit(readStorage(anonKey()));
      setHydrated(true);
      return;
    }

    // Signed in: paint the cached copy immediately so the page is not empty
    // for a round trip, then reconcile with the server.
    const cached = readStorage(cacheKey(userId));
    if (cached.length > 0) commit(cached);

    (async () => {
      const pending = readStorage(anonKey());

      try {
        const cart =
          pending.length > 0
            ? // The localStorage migration path: push whatever this browser
              // was holding before sign-in and adopt the merged result.
              await callApi("/api/cart/merge", {
                method: "POST",
                body: JSON.stringify({
                  lines: pending.map((line) => ({
                    productId: line.productId,
                    quantity: line.quantity,
                  })),
                }),
              })
            : await callApi("/api/cart");

        if (cancelled) return;
        applyServerCart(cart);
        // Only once the merge has actually landed. Dropping it earlier would
        // lose the cart if the request failed.
        if (pending.length > 0) dropStorage(anonKey());
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load your cart from the server.",
        );
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, applyServerCart, commit]);

  /* ---------- Anonymous persistence ---------- */

  useEffect(() => {
    if (!hydrated || userId) return;
    writeStorage(anonKey(), lines);
  }, [lines, hydrated, userId]);

  /* ---------- Live updates from other devices ---------- */

  useEffect(() => {
    if (!userId || !hydrated) return;

    // EventSource cannot carry an Authorization header, which is fine here:
    // this is same-origin, so the Auth.js session cookie goes with it. The
    // native client polls /api/cart/version instead.
    const stream = new EventSource("/api/cart/stream");

    stream.addEventListener("version", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        version: number;
      };

      // Our own writes come back through here too. Anything we have already
      // applied is not news.
      if (payload.version <= version.current) return;
      // A write of ours is still settling; its response is authoritative and
      // about to arrive, so do not race it with a GET.
      if (inFlight.current > 0) return;

      void callApi("/api/cart").then(applyServerCart).catch(() => {
        // Transient. The stream will report the next version anyway.
      });
    });

    // The route closes the connection just under the platform's function
    // limit; EventSource reconnects on its own, so an error here is routine
    // and deliberately not surfaced to the user.
    stream.addEventListener("error", () => {});

    return () => stream.close();
  }, [userId, hydrated, applyServerCart]);

  /* ---------- Mutations ---------- */

  const add = useCallback(
    (line: NewCartLine, quantity = 1) => {
      commit(addLine(linesRef.current, line, quantity));

      if (!userId) return;
      void push(() =>
        callApi("/api/cart/items", {
          method: "POST",
          body: JSON.stringify({ productId: line.productId, quantity }),
        }),
      );
    },
    [userId, push, commit],
  );

  const setQuantity = useCallback(
    (productId: number, quantity: number) => {
      commit(setLineQuantity(linesRef.current, productId, quantity));

      if (!userId) return;
      void push(() =>
        callApi(`/api/cart/items/${productId}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        }),
      );
    },
    [userId, push, commit],
  );

  const adjust = useCallback(
    (productId: number, delta: number) => {
      const line = linesRef.current.find((l) => l.productId === productId);
      if (!line) return;
      setQuantity(productId, line.quantity + delta);
    },
    [setQuantity],
  );

  const remove = useCallback(
    (productId: number) => {
      commit(removeLine(linesRef.current, productId));

      if (!userId) return;
      void push(() =>
        callApi(`/api/cart/items/${productId}`, { method: "DELETE" }),
      );
    },
    [userId, push, commit],
  );

  const clear = useCallback(() => {
    commit([]);

    if (!userId) return;
    // Checkout already empties the cart server-side as part of placing the
    // order, so this is usually a no-op that just confirms the local state.
    void push(() => callApi("/api/cart", { method: "DELETE" }));
  }, [userId, push, commit]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      hydrated,
      count: cartCount(lines),
      subtotalCents: cartSubtotalCents(lines),
      source,
      syncing,
      error,
      add,
      setQuantity,
      adjust,
      remove,
      clear,
    }),
    [
      lines,
      hydrated,
      source,
      syncing,
      error,
      add,
      setQuantity,
      adjust,
      remove,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
}

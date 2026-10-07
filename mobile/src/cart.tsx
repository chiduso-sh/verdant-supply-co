/**
 * The cart, mirrored from the server.
 *
 * The server owns it. This module keeps a local copy so taps feel immediate,
 * applies the same pure functions the web app uses for the optimistic edit
 * (`@shop/cart`), then replaces that copy with whatever the server says.
 *
 * Changes made on the website arrive by polling `/api/cart/version` — a
 * single indexed row read — and following up with a full read when the number
 * moves. The web app streams the same signal over SSE instead; React Native's
 * EventSource cannot attach an Authorization header, which is the whole
 * reason for the difference.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  addLine,
  cartCount,
  cartSubtotalCents,
  removeLine,
  setLineQuantity,
  type CartLine,
  type NewCartLine,
} from "@shop/cart";
import {
  addCartItem,
  ApiError,
  fetchCart,
  fetchCartVersion,
  removeCartItem,
  setCartItemQuantity,
  type ServerCart,
} from "./api";
import { useAuth } from "./auth";

/** How often to ask whether the cart changed elsewhere. */
const POLL_INTERVAL_MS = 2000;

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  refresh: () => void;
  add: (line: NewCartLine, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  /**
   * Nudges a quantity by a delta, resolved against the latest state rather
   * than whatever a component last rendered. Steppers must use this: two taps
   * landing in one React batch would otherwise both compute from the same
   * stale number and the second would be lost.
   */
  adjust: (productId: number, delta: number) => void;
  remove: (productId: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { token, status } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Highest version applied. Responses can land out of order — a poll-driven
   * read racing a mutation it already knows about — so anything at or below
   * this is dropped rather than flickering a stale cart back on screen.
   */
  const version = useRef(0);
  const inFlight = useRef(0);

  /**
   * The current lines, updated synchronously on every change.
   *
   * `lines` state is only visible to the next render, which is too late for a
   * handler that fires twice before React re-renders. Everything that needs
   * to read "the quantity right now" reads this instead.
   */
  const linesRef = useRef<CartLine[]>([]);

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
  }, []);

  const apply = useCallback(
    (cart: ServerCart) => {
      if (cart.version < version.current) return;
      version.current = cart.version;
      commit(cart.lines);
    },
    [commit],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      try {
        apply(await fetchCart(token, signal));
        setError(null);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(
          cause instanceof ApiError ? cause.message : "Could not load the cart.",
        );
      }
    },
    [token, apply],
  );

  /* ---------- Load on sign-in, clear on sign-out ---------- */

  useEffect(() => {
    if (!token) {
      commit([]);
      version.current = 0;
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    // A fresh account's cart starts a new version sequence that may be
    // numbered lower than the last one this app saw.
    version.current = 0;

    void load(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [token, load, commit]);

  /* ---------- Poll for changes made on another device ---------- */

  useEffect(() => {
    if (!token || status !== "signedIn") return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stopped) return;

      // Only while the app is actually on screen. Polling a backgrounded app
      // costs battery and nobody is looking at the result.
      if (AppState.currentState === "active" && inFlight.current === 0) {
        try {
          const latest = await fetchCartVersion(token);
          if (!stopped && latest > version.current) await load();
        } catch {
          // Transient. The next tick tries again.
        }
      }

      if (!stopped) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);

    // Coming back to the foreground should not wait for the next tick.
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && !stopped) void load();
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [token, status, load]);

  /* ---------- Mutations ---------- */

  const push = useCallback(
    async (run: (token: string) => Promise<ServerCart>) => {
      if (!token) return;

      inFlight.current += 1;
      setSyncing(true);
      try {
        apply(await run(token));
        setError(null);
      } catch (cause) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Could not update the cart.",
        );
        // Re-read rather than leaving the optimistic edit standing.
        await load();
      } finally {
        inFlight.current -= 1;
        if (inFlight.current === 0) setSyncing(false);
      }
    },
    [token, apply, load],
  );

  const add = useCallback(
    (line: NewCartLine, quantity = 1) => {
      commit(addLine(linesRef.current, line, quantity));
      void push((t) => addCartItem(t, line.productId, quantity));
    },
    [push, commit],
  );

  const setQuantity = useCallback(
    (productId: number, quantity: number) => {
      commit(setLineQuantity(linesRef.current, productId, quantity));
      void push((t) => setCartItemQuantity(t, productId, quantity));
    },
    [push, commit],
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
      void push((t) => removeCartItem(t, productId));
    },
    [push, commit],
  );

  const refresh = useCallback(() => void load(), [load]);

  return (
    <CartContext.Provider
      value={{
        lines,
        count: cartCount(lines),
        subtotalCents: cartSubtotalCents(lines),
        loading,
        syncing,
        error,
        refresh,
        add,
        setQuantity,
        adjust,
        remove,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}

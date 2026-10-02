"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

type CartContextValue = {
  lines: CartLine[];
  /** False until localStorage has been read, so SSR and first paint agree. */
  hydrated: boolean;
  count: number;
  subtotalCents: number;
  add: (line: NewCartLine, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartLine[] {
  try {
    return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    // Private mode or blocked site data: start empty rather than crash.
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Nothing to do — the cart still works for this page view.
    }
  }, [lines, hydrated]);

  const add = useCallback((line: NewCartLine, quantity = 1) => {
    setLines((current) => addLine(current, line, quantity));
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    setLines((current) => setLineQuantity(current, productId, quantity));
  }, []);

  const remove = useCallback((productId: number) => {
    setLines((current) => removeLine(current, productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      hydrated,
      count: cartCount(lines),
      subtotalCents: cartSubtotalCents(lines),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, hydrated, add, setQuantity, remove, clear],
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

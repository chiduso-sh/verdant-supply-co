"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NewCartLine } from "@/lib/cart";
import { useCart } from "./cart-provider";

export function AddToCart({
  product,
  showQuantity = false,
}: {
  product: NewCartLine;
  showQuantity?: boolean;
}) {
  const { add } = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending reset if the component unmounts mid-confirmation.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleAdd() {
    add(product, quantity);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showQuantity ? (
        <div className="inline-flex items-center rounded-full border border-line bg-card">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="px-3 py-2 text-ink-faint transition-colors duration-200 hover:text-ink disabled:opacity-40"
            disabled={quantity <= 1}
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={quantity}
            aria-label="Quantity"
            onChange={(event) =>
              setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))
            }
            className="w-10 border-0 bg-transparent p-0 text-center text-sm tabular-nums text-ink [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            aria-label="Increase quantity"
            className="px-3 py-2 text-ink-faint transition-colors duration-200 hover:text-ink disabled:opacity-40"
            disabled={quantity >= 99}
          >
            +
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleAdd}
        aria-live="polite"
        className={`relative overflow-hidden rounded-full px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(28,27,25,0.8)] active:translate-y-0 active:scale-[0.97] ${
          added ? "animate-[var(--animate-pop)] bg-leaf" : "bg-ink hover:bg-leaf"
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          {added ? (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  d="m4 12 5 5L20 6"
                  strokeDasharray="48"
                  className="animate-[var(--animate-draw)]"
                />
              </svg>
              Added
            </>
          ) : (
            "Add to cart"
          )}
        </span>
      </button>

      {showQuantity ? (
        <button
          type="button"
          onClick={() => {
            add(product, quantity);
            router.push("/cart");
          }}
          className="text-sm text-ink-faint transition-colors duration-200 hover:text-ink"
        >
          Add and view cart
        </button>
      ) : null}
    </div>
  );
}

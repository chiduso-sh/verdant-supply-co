"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart, type CartLine } from "./cart-provider";

export function AddToCart({
  product,
  showQuantity = false,
}: {
  product: Omit<CartLine, "quantity">;
  showQuantity?: boolean;
}) {
  const { add } = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    add(product, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showQuantity ? (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Qty
          <input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(event) =>
              setQuantity(Math.max(1, Math.min(99, Number(event.target.value))))
            }
            className="w-16 rounded-lg border border-line bg-card px-2 py-1.5 text-ink"
          />
        </label>
      ) : null}

      <button
        type="button"
        onClick={handleAdd}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-leaf"
      >
        {added ? "Added ✓" : "Add to cart"}
      </button>

      {showQuantity ? (
        <button
          type="button"
          onClick={() => {
            add(product, quantity);
            router.push("/cart");
          }}
          className="text-sm text-ink-faint underline-offset-4 transition hover:text-ink hover:underline"
        >
          Add and view cart
        </button>
      ) : null}
    </div>
  );
}

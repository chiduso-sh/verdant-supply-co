"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { formatCents } from "@/lib/money";

export default function CartPage() {
  const { lines, hydrated, subtotalCents, setQuantity, remove } = useCart();

  if (!hydrated) {
    return <p className="pt-16 text-sm text-ink-faint">Loading cart…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="pt-16">
        <h1 className="font-serif text-3xl text-ink">Your cart is empty</h1>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-leaf"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-12">
      <h1 className="font-serif text-3xl text-ink">Cart</h1>

      <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-card">
        {lines.map((line) => (
          <li key={line.productId} className="flex gap-4 p-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper">
              <Image
                src={line.imageUrl}
                alt={line.name}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>

            <div className="flex flex-1 flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/products/${line.slug}`}
                  className="font-serif text-lg text-ink underline-offset-4 hover:underline"
                >
                  {line.name}
                </Link>
                <p className="mt-1 text-sm text-ink-faint">
                  {formatCents(line.priceCents)} each
                </p>
                <button
                  type="button"
                  onClick={() => remove(line.productId)}
                  className="mt-2 text-xs text-ink-faint underline underline-offset-4 transition hover:text-ink"
                >
                  Remove
                </button>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={line.quantity}
                  onChange={(event) =>
                    setQuantity(line.productId, Number(event.target.value))
                  }
                  aria-label={`Quantity for ${line.name}`}
                  className="w-16 rounded-lg border border-line bg-card px-2 py-1.5 text-ink"
                />
                <span className="w-20 text-right font-medium text-ink">
                  {formatCents(line.priceCents * line.quantity)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">
            Subtotal
          </p>
          <p className="font-serif text-2xl text-ink">
            {formatCents(subtotalCents)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Prices are re-checked against the database at checkout.
          </p>
        </div>
        <Link
          href="/checkout"
          className="rounded-full bg-leaf px-6 py-3 text-sm font-medium text-white transition hover:bg-leaf-dark"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}

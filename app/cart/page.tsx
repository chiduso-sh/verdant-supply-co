"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { formatCents } from "@/lib/money";

export default function CartPage() {
  const { lines, hydrated, subtotalCents, setQuantity, remove } = useCart();

  // A skeleton rather than a spinner: the layout does not jump when the real
  // rows arrive a frame later.
  if (!hydrated) {
    return (
      <div className="pt-12">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-line" />
        <div className="mt-8 space-y-px overflow-hidden rounded-2xl border border-line bg-card">
          {[0, 1].map((row) => (
            <div key={row} className="flex gap-4 p-4">
              <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-paper" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-5 w-48 animate-pulse rounded bg-paper" />
                <div className="h-4 w-24 animate-pulse rounded bg-paper" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="animate-[var(--animate-fade-up)] pt-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-card">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-7 w-7 text-ink-faint"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h1 className="mt-6 font-serif text-3xl text-ink">
          Your cart is empty
        </h1>
        <p className="mt-2 text-ink-soft">Nothing picked out yet.</p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:bg-leaf hover:shadow-[0_12px_26px_-12px_rgba(28,27,25,0.8)] active:translate-y-0 active:scale-[0.98]"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-12">
      <h1 className="animate-[var(--animate-fade-up)] font-serif text-3xl text-ink">
        Cart
      </h1>

      <ul className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {lines.map((line, index) => (
          <li
            key={line.productId}
            style={{ animationDelay: `${index * 60}ms` }}
            className="flex animate-[var(--animate-fade-up)] gap-4 p-4 transition-colors duration-300 hover:bg-paper/60"
          >
            <Link
              href={`/products/${line.slug}`}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper"
            >
              <Image
                src={line.imageUrl}
                alt={line.name}
                fill
                sizes="80px"
                className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-110"
              />
            </Link>

            <div className="flex flex-1 flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/products/${line.slug}`}
                  className="font-serif text-lg text-ink transition-colors duration-200 hover:text-leaf"
                >
                  {line.name}
                </Link>
                <p className="mt-1 text-sm tabular-nums text-ink-faint">
                  {formatCents(line.priceCents)} each
                </p>
                <button
                  type="button"
                  onClick={() => remove(line.productId)}
                  className="mt-2 text-xs text-ink-faint underline underline-offset-4 transition-colors duration-200 hover:text-ochre"
                >
                  Remove
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="inline-flex items-center rounded-full border border-line">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(line.productId, line.quantity - 1)
                    }
                    aria-label={`Decrease quantity of ${line.name}`}
                    className="px-3 py-1.5 text-ink-faint transition-colors duration-200 hover:text-ink"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums text-ink">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(line.productId, line.quantity + 1)
                    }
                    aria-label={`Increase quantity of ${line.name}`}
                    className="px-3 py-1.5 text-ink-faint transition-colors duration-200 hover:text-ink"
                  >
                    +
                  </button>
                </div>
                <span className="w-20 text-right font-medium tabular-nums text-ink">
                  {formatCents(line.priceCents * line.quantity)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div
        style={{ animationDelay: "160ms" }}
        className="mt-6 flex animate-[var(--animate-fade-up)] flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card p-5"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">
            Subtotal
          </p>
          <p className="font-serif text-3xl tabular-nums text-ink">
            {formatCents(subtotalCents)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Prices are re-checked against the database at checkout.
          </p>
        </div>
        <Link
          href="/checkout"
          className="group inline-flex items-center gap-2 rounded-full bg-leaf px-7 py-3.5 text-sm font-medium text-white shadow-[0_2px_12px_-4px_rgba(47,93,74,0.6)] transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:bg-leaf-dark hover:shadow-[0_14px_30px_-12px_rgba(47,93,74,0.9)] active:translate-y-0 active:scale-[0.98]"
        >
          Checkout
          <span
            aria-hidden="true"
            className="transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

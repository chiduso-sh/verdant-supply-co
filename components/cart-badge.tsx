"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";

export function CartBadge() {
  const { count, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      className="relative rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition hover:border-ink-faint"
    >
      Cart
      {hydrated && count > 0 ? (
        <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-leaf px-1.5 py-0.5 text-xs font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

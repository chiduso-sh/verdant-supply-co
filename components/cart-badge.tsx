"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./cart-provider";

export function CartBadge() {
  const { count, hydrated } = useCart();
  const [bump, setBump] = useState(0);
  const previous = useRef(count);

  // Re-key the badge whenever the count actually changes, so the pop
  // animation replays. Hydration is not a change, so it stays quiet on load.
  useEffect(() => {
    if (hydrated && count !== previous.current) {
      previous.current = count;
      setBump((n) => n + 1);
    }
  }, [count, hydrated]);

  return (
    <Link
      href="/cart"
      className="group relative inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_6px_20px_-8px_rgba(28,27,25,0.35)] active:translate-y-0"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      Cart
      {hydrated && count > 0 ? (
        <span
          key={bump}
          className="inline-flex min-w-5 animate-[var(--animate-badge-pop)] items-center justify-center rounded-full bg-leaf px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

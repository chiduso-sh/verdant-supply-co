"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrder } from "@/app/checkout/actions";
import type { ShippingInput } from "@/lib/checkout";
import { formatCents } from "@/lib/money";
import { useCart } from "./cart-provider";

const EMPTY: ShippingInput = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
};

export function CheckoutForm({
  userName,
  userEmail,
}: {
  userName: string | null;
  userEmail: string;
}) {
  const { lines, hydrated, subtotalCents, clear } = useCart();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shipping, setShipping] = useState<ShippingInput>({
    ...EMPTY,
    fullName: userName ?? "",
  });

  function update(field: keyof ShippingInput) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setShipping((current) => ({ ...current, [field]: event.target.value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await placeOrder(
        lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        shipping,
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Only clear once the order is safely persisted.
      clear();
      router.push(`/orders/${result.orderId}?new=1`);
    });
  }

  if (!hydrated) {
    return (
      <div className="pt-12">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-line" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="h-80 animate-pulse rounded-2xl bg-line/50" />
          <div className="h-56 animate-pulse rounded-2xl bg-line/50" />
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="pt-16">
        <h1 className="font-serif text-3xl text-ink">Nothing to check out</h1>
        <p className="mt-3 text-ink-soft">Add something to your cart first.</p>
      </div>
    );
  }

  return (
    <div className="pt-12">
      <h1 className="animate-[var(--animate-fade-up)] font-serif text-3xl text-ink">Checkout</h1>
      <p className="mt-2 text-sm text-ink-faint">
        Confirmation will be emailed to{" "}
        <strong className="text-ink-soft">{userEmail}</strong>.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleSubmit} className="order-2 lg:order-1">
          <fieldset
            disabled={pending}
            className="rounded-2xl border border-line bg-card p-5 disabled:opacity-60"
          >
            <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Shipping address
            </legend>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                required
                value={shipping.fullName}
                onChange={update("fullName")}
                className="sm:col-span-2"
                autoComplete="name"
              />
              <Field
                label="Address"
                required
                value={shipping.line1}
                onChange={update("line1")}
                className="sm:col-span-2"
                autoComplete="address-line1"
              />
              <Field
                label="Apartment, suite (optional)"
                value={shipping.line2}
                onChange={update("line2")}
                className="sm:col-span-2"
                autoComplete="address-line2"
              />
              <Field
                label="City"
                required
                value={shipping.city}
                onChange={update("city")}
                autoComplete="address-level2"
              />
              <Field
                label="State / region"
                required
                value={shipping.state}
                onChange={update("state")}
                autoComplete="address-level1"
              />
              <Field
                label="Postal code"
                required
                value={shipping.postalCode}
                onChange={update("postalCode")}
                autoComplete="postal-code"
              />
              <Field
                label="Country"
                required
                value={shipping.country}
                onChange={update("country")}
                autoComplete="country-name"
              />
              <Field
                label="Phone (optional)"
                value={shipping.phone}
                onChange={update("phone")}
                className="sm:col-span-2"
                autoComplete="tel"
                type="tel"
              />
            </div>
          </fieldset>

          <p className="mt-4 rounded-xl border border-dashed border-line p-4 text-xs leading-relaxed text-ink-faint">
            No payment step: this is a demo build, so no card details are
            collected and nothing is charged. Placing the order writes it to the
            database and sends your confirmation email.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-4 animate-[var(--animate-fade-up)] rounded-xl border border-ochre/40 bg-ochre/5 p-4 text-sm text-ochre"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-leaf px-6 py-4 text-sm font-medium text-white shadow-[0_2px_12px_-4px_rgba(47,93,74,0.6)] transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:bg-leaf-dark hover:shadow-[0_14px_30px_-12px_rgba(47,93,74,0.9)] active:translate-y-0 active:scale-[0.99] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
          >
            {pending ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                />
                Placing order&hellip;
              </>
            ) : (
              <>
                Place order
                <span className="tabular-nums opacity-80">
                  {formatCents(subtotalCents)}
                </span>
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:translate-x-1"
                >
                  →
                </span>
              </>
            )}
          </button>
        </form>

        <aside className="order-1 h-fit rounded-2xl border border-line bg-card p-5 lg:order-2 lg:sticky lg:top-28">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Order summary
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {lines.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 py-3 transition-colors duration-300">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-paper">
                  <Image
                    src={line.imageUrl}
                    alt={line.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-ink">{line.name}</p>
                  <p className="text-xs text-ink-faint">Qty {line.quantity}</p>
                </div>
                <span className="text-sm text-ink">
                  {formatCents(line.priceCents * line.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm text-ink-soft">Total</span>
            <span className="font-serif text-xl text-ink">
              {formatCents(subtotalCents)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  className = "",
  required = false,
  type = "text",
  ...rest
}: {
  label: string;
  className?: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm text-ink-soft">
        {label}
        {required ? <span className="text-ochre"> *</span> : null}
      </span>
      <input
        type={type}
        required={required}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none transition-all duration-200 placeholder:text-ink-faint/60 hover:border-ink-faint/50 focus:border-leaf focus:bg-card focus:ring-2 focus:ring-leaf/15"
        {...rest}
      />
    </label>
  );
}

import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import { formatCents } from "@/lib/money";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const { new: isNew } = await searchParams;

  if (!session?.user?.id) redirect(`/signin?redirectTo=/orders/${id}`);

  // Ownership is part of the WHERE clause, not a check after the fact, so a
  // guessed order id returns 404 rather than someone else's address.
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) notFound();

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const addressLines = [
    order.shippingFullName,
    order.shippingLine1,
    order.shippingLine2,
    `${order.shippingCity}, ${order.shippingState} ${order.shippingPostalCode}`,
    order.shippingCountry,
    order.shippingPhone,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="mx-auto max-w-2xl pt-12">
      {isNew ? (
        <div className="mb-8 rounded-2xl border border-leaf/30 bg-leaf/5 p-5">
          <h1 className="font-serif text-2xl text-leaf">Order confirmed</h1>
          <p className="mt-2 text-sm text-ink-soft">
            We&rsquo;ve emailed a confirmation to{" "}
            <strong className="text-ink">{order.email}</strong>. Keep your order
            number handy: <strong className="font-mono">{order.orderNumber}</strong>
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-line bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-lg font-medium text-ink">
            {order.orderNumber}
          </h2>
          <span className="rounded-full bg-paper px-3 py-1 text-xs uppercase tracking-[0.1em] text-ink-faint">
            {order.status}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Placed{" "}
          {order.createdAt.toLocaleString("en-US", {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </p>

        <ul className="mt-6 divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div>
                <p className="text-sm text-ink">{item.nameSnapshot}</p>
                <p className="text-xs text-ink-faint">
                  Qty {item.quantity} × {formatCents(item.unitPriceCents)}
                </p>
              </div>
              <span className="text-sm text-ink">
                {formatCents(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-ink-soft">Total</span>
          <span className="font-serif text-xl text-ink">
            {formatCents(order.subtotalCents)}
          </span>
        </div>

        <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
          Shipping to
        </h3>
        <address className="mt-2 text-sm not-italic leading-relaxed text-ink-soft">
          {addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </div>

      <div className="mt-6 flex gap-4">
        <Link
          href="/orders"
          className="text-sm text-ink-faint underline-offset-4 transition hover:text-ink hover:underline"
        >
          All orders
        </Link>
        <Link
          href="/"
          className="text-sm text-ink-faint underline-offset-4 transition hover:text-ink hover:underline"
        >
          Back to shop
        </Link>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

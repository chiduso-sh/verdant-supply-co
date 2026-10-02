import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { formatCents } from "@/lib/money";

export default async function OrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-md pt-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Your orders</h1>
        <p className="mt-3 text-ink-soft">Sign in to see your order history.</p>
        <div className="mt-8 flex justify-center">
          <SignInButton redirectTo="/orders" />
        </div>
      </div>
    );
  }

  // Scoped to the session user. There is no route that returns someone
  // else's orders.
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.createdAt));

  return (
    <div className="pt-12">
      <h1 className="animate-[var(--animate-fade-up)] font-serif text-3xl text-ink">
        Your orders
      </h1>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-card p-6 text-sm text-ink-soft">
          No orders yet.{" "}
          <Link
            href="/"
            className="text-leaf underline underline-offset-4"
          >
            Go buy a plant.
          </Link>
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-card">
          {rows.map((order, index) => (
            <li
              key={order.id}
              style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
              className="group flex animate-[var(--animate-fade-up)] flex-wrap items-center justify-between gap-3 p-5 transition-colors duration-300 hover:bg-paper/60"
            >
              <div>
                <Link
                  href={`/orders/${order.id}`}
                  className="font-mono text-sm font-medium text-ink transition-colors duration-200 group-hover:text-leaf"
                >
                  {order.orderNumber}
                </Link>
                <p className="mt-1 text-xs text-ink-faint">
                  {order.createdAt.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  · {order.status}
                </p>
              </div>
              <span className="font-medium tabular-nums text-ink">
                {formatCents(order.subtotalCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { ProductCard } from "@/components/product-card";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

const CATEGORY_ORDER = ["Plants", "Vessels", "Care"];

export default async function HomePage() {
  const all = await db.select().from(products).orderBy(asc(products.id));

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: all.filter((product) => product.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="pt-12">
      <section className="max-w-xl">
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
          Things that grow, and the things you grow them in.
        </h1>
        <p className="mt-4 text-ink-soft">
          A small, opinionated catalogue. Sign in with Google at checkout and
          we&apos;ll email your confirmation.
        </p>
      </section>

      {all.length === 0 ? (
        <p className="mt-16 rounded-2xl border border-line bg-card p-6 text-sm text-ink-soft">
          No products yet. Run <code className="text-ochre">npm run db:push</code>{" "}
          then <code className="text-ochre">npm run db:seed</code>.
        </p>
      ) : (
        byCategory.map((group) => (
          <section key={group.category} className="mt-16">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              {group.category}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

// Products come from the database on every request; there is no build-time
// snapshot to go stale.
export const dynamic = "force-dynamic";

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
    <div className="pt-16 sm:pt-24">
      <section className="max-w-2xl">
        <p
          style={{ animationDelay: "40ms" }}
          className="animate-[var(--animate-fade-up)] text-xs font-semibold uppercase tracking-[0.18em] text-leaf"
        >
          Houseplants &amp; handmade vessels
        </p>
        <h1
          style={{ animationDelay: "120ms" }}
          className="mt-4 animate-[var(--animate-fade-up)] font-serif text-[2.6rem] leading-[1.08] tracking-tight text-balance text-ink sm:text-6xl"
        >
          Things that grow, and the things you grow them in.
        </h1>
        <p
          style={{ animationDelay: "220ms" }}
          className="mt-5 max-w-lg animate-[var(--animate-fade-up)] text-lg leading-relaxed text-ink-soft"
        >
          A small, opinionated catalogue. Sign in with Google at checkout and
          we&rsquo;ll email your confirmation.
        </p>

        <div
          style={{ animationDelay: "320ms" }}
          className="mt-8 flex animate-[var(--animate-fade-up)] flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-faint"
        >
          <Marker>{all.length} hand-picked items</Marker>
          <Marker>Secure Google sign-in</Marker>
          <Marker>Instant email confirmation</Marker>
        </div>
      </section>

      {all.length === 0 ? (
        <p className="mt-16 rounded-2xl border border-line bg-card p-6 text-sm text-ink-soft">
          No products yet. Run{" "}
          <code className="text-ochre">npm run db:push</code> then{" "}
          <code className="text-ochre">npm run db:seed</code>.
        </p>
      ) : (
        byCategory.map((group, groupIndex) => (
          <section key={group.category} className="mt-20">
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {group.category}
              </h2>
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs tabular-nums text-ink-faint">
                {group.items.length}
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={groupIndex * 2 + index}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Marker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-leaf" />
      {children}
    </span>
  );
}

// Products come from the database on every request; there is no build-time
// snapshot to go stale.
export const dynamic = "force-dynamic";

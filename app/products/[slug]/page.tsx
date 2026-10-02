import { eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { formatCents } from "@/lib/money";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  if (!product) notFound();

  return (
    <div className="pt-10">
      <Link
        href="/"
        className="group inline-flex items-center gap-1.5 text-sm text-ink-faint transition-colors duration-200 hover:text-ink"
      >
        <span
          aria-hidden="true"
          className="transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:-translate-x-1"
        >
          ←
        </span>
        All products
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-14">
        <div
          style={{ animationDelay: "60ms" }}
          className="group relative aspect-square animate-[var(--animate-rise)] overflow-hidden rounded-2xl border border-line bg-card"
        >
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-105"
            priority
          />
        </div>

        <div className="flex flex-col justify-center">
          <p
            style={{ animationDelay: "140ms" }}
            className="animate-[var(--animate-fade-up)] text-xs font-semibold uppercase tracking-[0.14em] text-leaf"
          >
            {product.category}
          </p>
          <h1
            style={{ animationDelay: "200ms" }}
            className="mt-3 animate-[var(--animate-fade-up)] font-serif text-4xl leading-[1.1] tracking-tight text-balance text-ink sm:text-5xl"
          >
            {product.name}
          </h1>
          <p
            style={{ animationDelay: "260ms" }}
            className="mt-4 animate-[var(--animate-fade-up)] text-2xl font-medium tabular-nums text-ink"
          >
            {formatCents(product.priceCents)}
          </p>
          <p
            style={{ animationDelay: "320ms" }}
            className="mt-5 animate-[var(--animate-fade-up)] text-lg leading-relaxed text-ink-soft"
          >
            {product.description}
          </p>

          <div
            style={{ animationDelay: "400ms" }}
            className="mt-8 animate-[var(--animate-fade-up)]"
          >
            <AddToCart
              showQuantity
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                imageUrl: product.imageUrl,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

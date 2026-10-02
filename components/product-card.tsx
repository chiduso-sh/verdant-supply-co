import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/db/schema";
import { formatCents } from "@/lib/money";
import { AddToCart } from "./add-to-cart";

export function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  /** Position in the grid, used only to stagger the entrance animation. */
  index?: number;
}) {
  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
      className="group flex animate-[var(--animate-rise)] flex-col overflow-hidden rounded-2xl border border-line bg-card transition-all duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1.5 hover:border-line/60 hover:shadow-[0_22px_45px_-24px_rgba(28,27,25,0.5)]"
    >
      <Link
        href={`/products/${product.slug}`}
        className="relative block overflow-hidden bg-paper"
      >
        <div className="relative aspect-square">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.07]"
          />
          {/* Darkens slightly on hover so the category chip stays readable. */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </div>

        <span className="absolute left-3 top-3 rounded-full bg-card/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft backdrop-blur-sm transition-all duration-500 group-hover:bg-card">
          {product.category}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <Link href={`/products/${product.slug}`}>
            <h3 className="font-serif text-lg leading-snug text-ink transition-colors duration-300 group-hover:text-leaf">
              {product.name}
            </h3>
          </Link>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-faint">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-medium tabular-nums text-ink">
            {formatCents(product.priceCents)}
          </span>
          <AddToCart
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
    </article>
  );
}

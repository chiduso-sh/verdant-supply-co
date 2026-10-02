import Image from "next/image";
import Link from "next/link";
import { formatCents } from "@/lib/money";
import type { Product } from "@/lib/db/schema";
import { AddToCart } from "./add-to-cart";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-paper">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <Link href={`/products/${product.slug}`}>
            <h3 className="font-serif text-lg leading-snug text-ink">
              {product.name}
            </h3>
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-ink-faint">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-ink">
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

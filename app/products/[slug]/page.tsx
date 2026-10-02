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
        className="text-sm text-ink-faint underline-offset-4 transition hover:text-ink hover:underline"
      >
        ← All products
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-card">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
            {product.category}
          </p>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-4 text-lg font-medium text-ink">
            {formatCents(product.priceCents)}
          </p>
          <p className="mt-5 leading-relaxed text-ink-soft">
            {product.description}
          </p>

          <div className="mt-8">
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

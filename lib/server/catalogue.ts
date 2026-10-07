/**
 * Catalogue reads for the HTTP API.
 *
 * The web pages query Drizzle directly because they are server components and
 * can; the API needs a serialized shape (Date out, ISO string in) and one
 * place that decides which columns are public. Both read the same table, so
 * there is no second source of prices.
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

/** The category order the home page renders in, so mobile matches it. */
export const CATEGORY_ORDER = ["Plants", "Vessels", "Care"] as const;

export type ApiProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  category: string;
};

const COLUMNS = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  description: products.description,
  priceCents: products.priceCents,
  imageUrl: products.imageUrl,
  category: products.category,
};

/**
 * The whole catalogue, ordered by id.
 *
 * Unpaginated on purpose: this is a dozen products, and inventing a cursor
 * API for it would be more code than the thing it serves. Revisit if the
 * catalogue ever stops fitting in one response.
 */
export async function listProducts(): Promise<ApiProduct[]> {
  return db.select(COLUMNS).from(products).orderBy(asc(products.id));
}

/** Products grouped the way the shop front renders them. */
export async function listProductsByCategory(): Promise<
  { category: string; items: ApiProduct[] }[]
> {
  const all = await listProducts();

  const known = CATEGORY_ORDER.map((category) => ({
    category,
    items: all.filter((product) => product.category === category),
  })).filter((group) => group.items.length > 0);

  // Anything seeded under a category this list has not heard of still has to
  // appear, or adding a category to the database would silently hide stock.
  const extras = all.filter(
    (product) =>
      !CATEGORY_ORDER.includes(product.category as (typeof CATEGORY_ORDER)[number]),
  );

  const extraGroups = [...new Set(extras.map((p) => p.category))].map(
    (category) => ({
      category,
      items: extras.filter((product) => product.category === category),
    }),
  );

  return [...known, ...extraGroups];
}

export async function readProduct(slug: string): Promise<ApiProduct | null> {
  const [product] = await db
    .select(COLUMNS)
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  return product ?? null;
}

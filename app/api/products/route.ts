import { listProducts, listProductsByCategory } from "@/lib/server/catalogue";
import { json, route } from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * GET /api/products
 * GET /api/products?grouped=1  — grouped by category, in shop-front order
 *
 * Public: the catalogue is what the shop front already renders to anyone.
 */
export const GET = route(async (request: Request) => {
  const grouped = new URL(request.url).searchParams.get("grouped");

  if (grouped === "1" || grouped === "true") {
    return json({ groups: await listProductsByCategory() });
  }

  return json({ products: await listProducts() });
});

export const dynamic = "force-dynamic";

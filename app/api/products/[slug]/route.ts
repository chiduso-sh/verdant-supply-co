import { readProduct } from "@/lib/server/catalogue";
import { apiError, json, route } from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/** GET /api/products/:slug */
export const GET = route(
  async (
    _request: Request,
    context: { params: Promise<{ slug: string }> },
  ) => {
    const { slug } = await context.params;
    const product = await readProduct(slug);

    if (!product) return apiError(404, "No such product.", "not_found");

    return json({ product });
  },
);

export const dynamic = "force-dynamic";

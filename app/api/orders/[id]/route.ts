import { readOrder } from "@/lib/server/orders";
import { apiError, json, requireCaller, route } from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * GET /api/orders/:id
 *
 * Ownership is enforced inside `readOrder`'s WHERE clause, not by a check
 * afterwards, so a guessed id yields a 404 rather than someone else's
 * shipping address. Any future route that reads an order must do the same.
 */
export const GET = route(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const caller = await requireCaller(request);
    const { id } = await context.params;

    const order = await readOrder(caller.userId, id);
    if (!order) return apiError(404, "No such order.", "not_found");

    return json({ order });
  },
);

export const dynamic = "force-dynamic";

import { json, requireCaller, route } from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * GET /api/me — who the caller is.
 *
 * The mobile app calls this on launch to decide whether its stored token is
 * still good: a 401 means pair again. `via` is included so it is possible to
 * see at a glance whether a request authenticated by cookie or by token,
 * which is the first thing worth knowing when sync misbehaves.
 */
export const GET = route(async (request: Request) => {
  const caller = await requireCaller(request);

  return json({
    user: {
      id: caller.userId,
      email: caller.email,
      name: caller.name,
    },
    via: caller.via,
  });
});

export const dynamic = "force-dynamic";

import { readCartVersion } from "@/lib/server/cart";
import { requireCaller, route } from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * GET /api/cart/stream — server-sent events when this user's cart changes.
 *
 * This is what "the cart syncs instantly" means in this build, and it is
 * worth being precise about the limits.
 *
 * It is a *server-side poll* behind a push-shaped interface: the handler
 * reads `cart.version` every POLL_INTERVAL_MS and emits an event when the
 * number moves. So a change lands on the other device in under two seconds,
 * not in microseconds. True push would mean a realtime provider (Pusher,
 * Ably, Supabase Realtime) because Vercel's serverless functions cannot hold
 * a websocket — a new third-party dependency and a new set of credentials.
 * The trade was made in favour of no new vendor.
 *
 * The connection also cannot live forever: a Vercel function has a maximum
 * duration, so the stream closes itself just under it and the browser's
 * EventSource reconnects on its own. Clients must therefore treat a close as
 * routine rather than as an error.
 *
 * Cookie-authenticated in practice, because EventSource cannot send an
 * Authorization header. Native clients poll /api/cart/version instead.
 */

/** How often the server re-reads the version. */
const POLL_INTERVAL_MS = 1_500;
/** A comment line often enough to stop an idle proxy closing the connection. */
const HEARTBEAT_MS = 15_000;
/** Closed just under the function's ceiling so the client reconnects cleanly. */
const MAX_STREAM_MS = 55_000;

export const maxDuration = 60;

export const GET = route(async (request: Request) => {
  const caller = await requireCaller(request);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const startedAt = Date.now();
      let lastHeartbeat = startedAt;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the runtime when the client went away.
        }
      };

      // A client that reconnects mid-change must not miss it, so the first
      // thing down the wire is the current version rather than a wait for the
      // next one.
      let lastVersion = await readCartVersion(caller.userId);
      send("version", { version: lastVersion });

      // `retry:` tells EventSource how long to wait before reconnecting after
      // the periodic close below.
      controller.enqueue(encoder.encode("retry: 1000\n\n"));

      request.signal.addEventListener("abort", close);

      while (!closed) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (closed || request.signal.aborted) break;

        if (Date.now() - startedAt > MAX_STREAM_MS) {
          send("bye", { reason: "max_duration" });
          break;
        }

        try {
          const version = await readCartVersion(caller.userId);
          if (version !== lastVersion) {
            lastVersion = version;
            send("version", { version });
          }
        } catch (error) {
          // A transient database error should not kill the stream; the client
          // would reconnect anyway, but churning the connection is worse than
          // skipping one tick.
          console.error("[cart stream] version read failed:", error);
        }

        if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
          lastHeartbeat = Date.now();
          if (!closed) controller.enqueue(encoder.encode(": keepalive\n\n"));
        }
      }

      close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // Nginx and some CDNs buffer by default, which would defeat the point.
      "x-accel-buffering": "no",
      "access-control-allow-origin": "*",
    },
  });
});

export const dynamic = "force-dynamic";

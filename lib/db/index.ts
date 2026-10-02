import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * The Drizzle client.
 *
 * Constructed eagerly and not behind a lazy wrapper: @auth/drizzle-adapter
 * inspects the client to work out its dialect, so it has to be handed the
 * real instance. DATABASE_URL therefore has to be present at build time as
 * well as at runtime — set it in Vercel's environment variables too, not just
 * locally. Nothing connects here; the HTTP driver only opens a connection
 * when a query actually runs.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.",
  );
}

export const db = drizzle(neon(process.env.DATABASE_URL), { schema });
export { schema };

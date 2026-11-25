import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { connection } from "next/server";
import * as schema from "./schema";

export type AppDatabase = NeonDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let database: AppDatabase | null = null;
let ready: Promise<AppDatabase | null> | null = null;

async function openDatabase() {
  if (process.env.DATABASE_URL) {
    const { drizzle: drizzleNeon } = await import("drizzle-orm/neon-serverless");
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    const ws = (await import("ws")).default;
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzleNeon(pool, { schema });
  }

  if (process.env.VERCEL) return null;

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const client = new PGlite(".data/pglite");
  return drizzlePglite(client, { schema });
}

export function resetDb() {
  ready = null;
  database = null;
}

export function getDb() {
  if (!ready) {
    ready = openDatabase().then((value) => {
      database = value;
      return value;
    });
  }
  return ready;
}

export async function requireDb() {
  await connection();
  const db = await getDb();
  if (!db) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return db;
}

export { schema };

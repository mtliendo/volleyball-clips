import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: Database;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString,
    max: process.env.VERCEL ? 1 : 5,
  });

  if (process.env.VERCEL) {
    attachDatabasePool(pool);
  }

  return pool;
}

export function getDb() {
  if (!globalForDb.db) {
    globalForDb.pool ??= createPool();
    globalForDb.db = drizzle(globalForDb.pool, { schema });
  }

  return globalForDb.db;
}

export type { Database };

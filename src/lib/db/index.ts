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

function withVerifyFull(connectionString: string) {
  if (/[?&]sslmode=verify-full(?:&|$)/i.test(connectionString)) {
    return connectionString;
  }
  if (/[?&]sslmode=require(?:&|$)/i.test(connectionString)) {
    return connectionString.replace(/([?&]sslmode=)require(?=&|$)/i, "$1verify-full");
  }
  return connectionString.includes("?")
    ? `${connectionString}&sslmode=verify-full`
    : `${connectionString}?sslmode=verify-full`;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: withVerifyFull(connectionString),
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

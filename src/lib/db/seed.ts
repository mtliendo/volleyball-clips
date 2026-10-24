import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { SEED_TAGS, tags } from "./schema";

config({ path: ".env.local" });
config({ path: ".env" });

async function seed() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  await db
    .insert(tags)
    .values([...SEED_TAGS])
    .onConflictDoNothing({ target: tags.slug });

  await pool.end();
  console.log("Seeded tags:", SEED_TAGS.map((tag) => tag.slug).join(", "));
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

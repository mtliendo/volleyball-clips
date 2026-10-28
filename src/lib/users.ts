import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "./db/schema";
import { isDatabaseConfigured } from "./env";
import type { AuthUser } from "./roles";

export type AppUser = typeof users.$inferSelect;

export async function ensureAppUser(authUser: AuthUser): Promise<AppUser | null> {
  if (!isDatabaseConfigured() || !authUser.sub) {
    return null;
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.auth0Sub, authUser.sub))
    .limit(1);

  const email = typeof authUser.email === "string" ? authUser.email : existing?.email ?? null;
  const name =
    (typeof authUser.name === "string" && authUser.name) ||
    (typeof authUser.nickname === "string" && authUser.nickname) ||
    existing?.name ||
    null;

  if (existing) {
    if (existing.email === email && existing.name === name) {
      return existing;
    }
    const [updated] = await db
      .update(users)
      .set({ email, name, updatedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      auth0Sub: authUser.sub,
      email,
      name,
    })
    .returning();

  return created ?? null;
}

export async function getUserById(userId: string) {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function getUserByStripeCustomerId(customerId: string) {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return row ?? null;
}

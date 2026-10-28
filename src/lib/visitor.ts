import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { dayKey } from "./dates";

export const VISITOR_COOKIE = "vb_vid";

function hashSecret() {
  return process.env.ANON_HASH_SECRET || process.env.AUTH0_SECRET || "vb-pov-anon-hash";
}

export function hashIp(ip: string) {
  return createHash("sha256").update(`${hashSecret()}:${ip}`).digest("hex");
}

export function clientIpFromHeaders(headerStore: Headers) {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headerStore.get("x-real-ip")?.trim() || "unknown";
}

export async function getVisitorIdentity() {
  const jar = await cookies();
  const headerStore = await headers();
  let visitorId = jar.get(VISITOR_COOKIE)?.value;
  let issued = false;

  if (!visitorId || !/^[0-9a-f-]{36}$/i.test(visitorId)) {
    visitorId = randomUUID();
    issued = true;
  }

  return {
    visitorId,
    issued,
    ipHash: hashIp(clientIpFromHeaders(headerStore)),
    watchedOn: dayKey(new Date()),
  };
}

export function visitorCookieHeader(visitorId: string) {
  const parts = [
    `${VISITOR_COOKIE}=${visitorId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

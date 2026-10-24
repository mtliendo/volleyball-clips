import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth0 } from "./auth0";
import { isAuth0Configured } from "./env";

export async function getSession() {
  if (!isAuth0Configured()) {
    return null;
  }

  return auth0.getSession();
}

export async function requireAdminPage(returnTo = "/admin") {
  const session = await getSession();
  if (!session) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

export async function requireAdminApi() {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

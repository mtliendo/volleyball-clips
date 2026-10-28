import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth0 } from "./auth0";
import { isAuth0Configured } from "./env";
import { isAdmin } from "./roles";

export { isAdmin, ROLES_CLAIM, ADMIN_ROLE } from "./roles";

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
  if (!isAdmin(session)) {
    redirect("/not-authorized");
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
  if (!isAdmin(session)) {
    return {
      session,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

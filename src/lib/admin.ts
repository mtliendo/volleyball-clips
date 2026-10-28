import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth0 } from "./auth0";
import { isAuth0Configured } from "./env";
import { isAdmin, type AuthUser } from "./roles";

export type AppSession = {
  user: AuthUser;
};

export async function getSession(): Promise<AppSession | null> {
  if (!isAuth0Configured()) {
    return null;
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return null;
  }

  return { user: session.user as AuthUser };
}

export async function requireUserPage(returnTo: string) {
  const session = await getSession();
  if (!session) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

export async function requireAdminPage(returnTo = "/admin") {
  const session = await getSession();
  if (!session) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  if (!isAdmin(session.user)) {
    redirect("/not-authorized");
  }
  return session;
}

export async function requireUserApi() {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export async function requireAdminApi() {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isAdmin(session.user)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

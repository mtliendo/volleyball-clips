import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/env";
import { isAdmin } from "@/lib/roles";

export async function proxy(request: NextRequest) {
  if (!isAuth0Configured()) {
    return NextResponse.next();
  }

  const authRes = await auth0.middleware(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth") || pathname.startsWith("/api/webhooks")) {
    return authRes;
  }

  const needsAdmin =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!needsAdmin) {
    return authRes;
  }

  const session = await auth0.getSession(request);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const login = new URL("/auth/login", request.url);
    login.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(login);
  }

  if (!isAdmin(session)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.redirect(new URL("/not-authorized", request.url));
  }

  return authRes;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

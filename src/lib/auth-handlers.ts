import { type NextRequest } from "next/server";
import { auth0 } from "./auth0";
import { isAuth0Configured } from "./env";

export function safeReturnTo(value: string | null): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }
  return value;
}

function authNotConfigured() {
  return new Response("Auth is not configured", { status: 503 });
}

/** Start Auth0 Universal Login. Used by GET /auth/login so the path exists. */
export async function handleAuthLogin(request: NextRequest) {
  if (!isAuth0Configured()) {
    return authNotConfigured();
  }

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const screenHint = request.nextUrl.searchParams.get("screen_hint");

  return auth0.startInteractiveLogin(
    {
      returnTo,
      authorizationParameters: screenHint ? { screen_hint: screenHint } : undefined,
    },
    request,
  );
}

/** Delegate logout/callback/profile/etc. to the Auth0 SDK. */
export async function handleAuthMountedRoute(request: NextRequest) {
  if (!isAuth0Configured()) {
    return authNotConfigured();
  }
  return auth0.middleware(request);
}

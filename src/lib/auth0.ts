import { Auth0Client, filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";
import { ROLES_CLAIM } from "./roles";

function claimsFromIdToken(idToken: string | null): Record<string, unknown> {
  if (!idToken) {
    return {};
  }
  const payload = idToken.split(".")[1];
  if (!payload) {
    return {};
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN ?? "example.auth0.com",
  clientId: process.env.AUTH0_CLIENT_ID ?? "build-placeholder",
  clientSecret: process.env.AUTH0_CLIENT_SECRET ?? "build-placeholder",
  secret: process.env.AUTH0_SECRET ?? "0".repeat(64),
  // Omit APP_BASE_URL so preview hosts can be inferred from the request.
  // A hardcoded localhost fallback made isAuth0Configured fail on Vercel previews
  // and left /auth/login unmounted.
  ...(process.env.APP_BASE_URL ? { appBaseUrl: process.env.APP_BASE_URL } : {}),
  // v4 drops custom ID-token claims unless this hook keeps them.
  async beforeSessionSaved(session, idToken) {
    const claims = claimsFromIdToken(idToken);
    const roles = claims[ROLES_CLAIM] ?? session.user[ROLES_CLAIM];
    return {
      ...session,
      user: {
        ...filterDefaultIdTokenClaims(session.user),
        [ROLES_CLAIM]: roles,
      },
    };
  },
});

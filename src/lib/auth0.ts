import { Auth0Client, filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";
import { ROLES_CLAIM } from "./roles";

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN ?? "example.auth0.com",
  clientId: process.env.AUTH0_CLIENT_ID ?? "build-placeholder",
  clientSecret: process.env.AUTH0_CLIENT_SECRET ?? "build-placeholder",
  secret: process.env.AUTH0_SECRET ?? "0".repeat(64),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  // v4 drops custom ID-token claims unless this hook keeps them.
  async beforeSessionSaved(session) {
    return {
      ...session,
      user: {
        ...filterDefaultIdTokenClaims(session.user),
        [ROLES_CLAIM]: session.user[ROLES_CLAIM],
      },
    };
  },
});

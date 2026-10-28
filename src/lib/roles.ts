export const ROLES_CLAIM = "https://vbpov.com/roles";
export const ADMIN_ROLE = "admin";

export type AuthUser = {
  sub?: string;
  email?: string | null;
  name?: string | null;
  nickname?: string | null;
  picture?: string | null;
  [key: string]: unknown;
};

type SessionLike = {
  user?: AuthUser | null;
} | null | undefined;

export function getRoles(user?: AuthUser | null): string[] {
  if (!user) {
    return [];
  }

  const raw = user[ROLES_CLAIM];
  if (Array.isArray(raw)) {
    return raw.filter((role): role is string => typeof role === "string");
  }
  if (typeof raw === "string" && raw.length > 0) {
    return [raw];
  }
  return [];
}

/**
 * True when the Auth0 session user has the `admin` role on the
 * `https://vbpov.com/roles` custom claim (string array from the post-login Action).
 * Accepts a session (`{ user }`) or the user object itself.
 */
export function isAdmin(sessionOrUser?: SessionLike | AuthUser | null): boolean {
  if (!sessionOrUser) {
    return false;
  }

  const user =
    "user" in sessionOrUser && !("sub" in sessionOrUser)
      ? sessionOrUser.user
      : (sessionOrUser as AuthUser);

  return getRoles(user).includes(ADMIN_ROLE);
}

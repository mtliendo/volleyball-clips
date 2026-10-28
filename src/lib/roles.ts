export const ROLES_CLAIM = "https://vbpov.com/roles";
export const ADMIN_ROLE = "admin";

type SessionLike = {
  user?: {
    [key: string]: unknown;
  } | null;
} | null | undefined;

/**
 * True when the Auth0 session user has the `admin` role on the
 * `https://vbpov.com/roles` custom claim (string array from the post-login Action).
 */
export function isAdmin(session: SessionLike): boolean {
  const roles = session?.user?.[ROLES_CLAIM];
  return Array.isArray(roles) && roles.includes(ADMIN_ROLE);
}

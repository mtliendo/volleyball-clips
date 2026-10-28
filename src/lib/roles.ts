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

export function isAdmin(user?: AuthUser | null): boolean {
  return getRoles(user).includes(ADMIN_ROLE);
}

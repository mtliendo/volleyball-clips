export function authLoginHref(
  input: { returnTo?: string; signup?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (input.returnTo) {
    params.set("returnTo", input.returnTo);
  }
  if (input.signup) {
    params.set("screen_hint", "signup");
  }
  const query = params.toString();
  return query ? `/auth/login?${query}` : "/auth/login";
}

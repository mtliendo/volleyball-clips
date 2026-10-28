import { mergeUtmIntoPath } from "./utm";

export function authLoginHref(
  input: { returnTo?: string; signup?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (input.returnTo) {
    const landingSearch = typeof window !== "undefined" ? window.location.search : "";
    params.set("returnTo", mergeUtmIntoPath(input.returnTo, landingSearch));
  }
  if (input.signup) {
    params.set("screen_hint", "signup");
  }
  const query = params.toString();
  return query ? `/auth/login?${query}` : "/auth/login";
}

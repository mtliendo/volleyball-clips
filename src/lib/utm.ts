export const UTM_PARAM_NAMES = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function asSearchParams(search: string | URLSearchParams | null | undefined) {
  if (!search) return new URLSearchParams();
  if (typeof search === "string") {
    return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  }
  return new URLSearchParams(search);
}

export function pickUtmParams(search: string | URLSearchParams | null | undefined) {
  const source = asSearchParams(search);
  const utm = new URLSearchParams();
  for (const key of UTM_PARAM_NAMES) {
    const value = source.get(key);
    if (value) {
      utm.set(key, value);
    }
  }
  return utm;
}

/** Keep landing UTMs when rewriting a path (auth returnTo, in-feed URL updates). */
export function mergeUtmIntoPath(
  path: string,
  search: string | URLSearchParams | null | undefined,
) {
  const utm = pickUtmParams(search);
  if ([...utm.keys()].length === 0) {
    return path;
  }

  const url = new URL(path, SITE_ORIGIN);
  for (const [key, value] of utm) {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }
  return `${url.pathname}${url.search}`;
}

const SITE_ORIGIN = "https://vbpov.com";

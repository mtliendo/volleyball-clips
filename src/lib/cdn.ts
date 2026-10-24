export function cdnUrl(key?: string | null) {
  if (!key) {
    return "";
  }

  const base = process.env.NEXT_PUBLIC_CDN_URL?.replace(/\/$/, "");
  if (!base) {
    return "";
  }

  return `${base}/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

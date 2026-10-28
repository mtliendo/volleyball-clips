/** Drop the S3 original key so it never reaches a browser or public JSON. */
export function omitOriginalKey<T extends { originalKey?: unknown }>(row: T): Omit<T, "originalKey"> {
  const rest = { ...row };
  delete rest.originalKey;
  return rest;
}

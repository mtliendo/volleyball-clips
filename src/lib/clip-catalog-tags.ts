export type SqlExec = (sql: string, params: unknown[]) => Promise<unknown>;

/** Delete every clip_tags row for the clip, then insert the mapped set. Not a merge. */
export async function replaceClipCatalogTags(
  exec: SqlExec,
  clipId: string,
  tagIds: string[],
) {
  await exec("DELETE FROM clip_tags WHERE clip_id = $1", [clipId]);
  const unique = [...new Set(tagIds)];
  for (const tagId of unique) {
    await exec(
      "INSERT INTO clip_tags (clip_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [clipId, tagId],
    );
  }
}

export type ClipMediaRecord = {
  id: string;
  gameId: string;
  originalKey: string;
  playbackKey?: string | null;
  posterKey?: string | null;
};

export type ClipDeleteAuth = { ok: true } | { ok: false; status: number; error: string };

export type ClipDeleteFailedObject = { key: string; message: string };

export type AdminClipDeleteDeps = {
  authorize: () => Promise<ClipDeleteAuth>;
  isDatabaseConfigured: () => boolean;
  isS3Configured: () => boolean;
  isUuid: (id: string) => boolean;
  findClip: (id: string) => Promise<ClipMediaRecord | null>;
  deleteClipObjects: (
    clips: ClipMediaRecord[],
  ) => Promise<{ failed: ClipDeleteFailedObject[] }>;
  deleteRows: (id: string) => Promise<void>;
  revalidate: (input: { gameId: string; clipId: string }) => void;
};

export type AdminClipDeleteResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function deleteAdminClip(
  clipId: string,
  deps: AdminClipDeleteDeps,
): Promise<AdminClipDeleteResult> {
  const auth = await deps.authorize();
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }
  if (!deps.isDatabaseConfigured()) {
    return { status: 503, body: { error: "Database is not configured" } };
  }
  if (!deps.isUuid(clipId)) {
    return { status: 404, body: { error: "Clip not found" } };
  }

  const clip = await deps.findClip(clipId);
  if (!clip) {
    return { status: 404, body: { error: "Clip not found" } };
  }

  if (!deps.isS3Configured()) {
    return {
      status: 503,
      body: { error: "S3 is not configured; clip files cannot be deleted" },
    };
  }

  let failed: ClipDeleteFailedObject[] = [];
  try {
    ({ failed } = await deps.deleteClipObjects([clip]));
  } catch (err) {
    return {
      status: 502,
      body: {
        error:
          err instanceof Error
            ? err.message
            : "Could not delete S3 objects. Database rows were left unchanged.",
      },
    };
  }

  if (failed.length > 0) {
    return {
      status: 502,
      body: {
        error: "Could not delete all S3 objects. Database rows were left unchanged.",
        failed,
      },
    };
  }

  await deps.deleteRows(clipId);
  deps.revalidate({ gameId: clip.gameId, clipId });
  return { status: 200, body: { ok: true } };
}

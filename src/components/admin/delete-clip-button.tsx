"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestAdminClipDelete } from "@/lib/clip-delete";

export function DeleteClipButton({
  clipId,
  redirectTo,
}: {
  clipId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    if (
      !window.confirm(
        "Delete this clip? The original, playback, and poster files will be removed. This cannot be undone.",
      )
    ) {
      return;
    }

    setPending(true);
    setError("");
    const result = await requestAdminClipDelete(clipId);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={pending}
        className="text-xs text-error disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </div>
  );
}

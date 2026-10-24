"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteClipButton({ clipId }: { clipId: string }) {
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
    const response = await fetch(`/api/admin/clips/${clipId}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not delete clip");
      setPending(false);
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
        className="text-xs text-court disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? <p className="text-xs text-court">{error}</p> : null}
    </div>
  );
}

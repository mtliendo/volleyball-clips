"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteGameButton({
  gameId,
  label,
  href,
}: {
  gameId: string;
  label: string;
  href: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    if (
      !window.confirm(
        `Delete ${label} and all of its clips? Originals, playback copies, and posters will be removed. This cannot be undone.`,
      )
    ) {
      return;
    }

    setPending(true);
    setError("");
    const response = await fetch(`/api/admin/games/${gameId}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not delete game");
      setPending(false);
      return;
    }

    router.push(href);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={pending}
        className="text-sm text-error disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete session"}
      </button>
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}

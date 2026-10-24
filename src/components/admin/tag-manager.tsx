"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Tag = { id: string; slug: string; name: string };

export function TagManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function createTag(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError((await response.json()).error ?? "Could not create tag");
      return;
    }
    setName("");
    router.refresh();
  }

  async function renameTag(tag: Tag) {
    const next = window.prompt("Tag name", tag.name);
    if (!next || next === tag.name) return;
    await fetch(`/api/admin/tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    router.refresh();
  }

  async function deleteTag(tag: Tag) {
    if (!window.confirm(`Delete ${tag.name}?`)) return;
    const response = await fetch(`/api/admin/tags/${tag.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError((await response.json()).error ?? "Could not delete tag");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createTag} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New tag"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-panel-2 px-3 py-3 text-sm outline-none focus:border-court"
          required
        />
        <button
          type="submit"
          className="rounded-2xl bg-court px-4 text-sm font-medium text-background"
        >
          Add
        </button>
      </form>
      {error ? <p className="text-sm text-court">{error}</p> : null}
      <ul className="space-y-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3"
          >
            <div>
              <p>{tag.name}</p>
              <p className="text-xs text-muted">{tag.slug}</p>
            </div>
            <div className="flex gap-3 text-sm text-muted">
              <button type="button" onClick={() => renameTag(tag)}>
                Edit
              </button>
              <button type="button" onClick={() => deleteTag(tag)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authLoginHref } from "@/lib/auth-urls";

export function FavoriteButton({
  clipId,
  favorited,
  canFavorite,
  returnTo,
}: {
  clipId: string;
  favorited: boolean;
  canFavorite: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(favorited);
  const [pending, setPending] = useState(false);

  if (!canFavorite) {
    return (
      <a
        href={authLoginHref({ returnTo, signup: true })}
        className="icon-btn"
        aria-label="Sign in to favorite"
      >
        <HeartIcon filled={false} />
      </a>
    );
  }

  async function toggle() {
    setPending(true);
    const next = !on;
    setOn(next);
    const response = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId }),
    });
    if (!response.ok) {
      setOn(!next);
    }
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={on}
      aria-label={on ? "Remove favorite" : "Save favorite"}
      disabled={pending}
      onClick={() => void toggle()}
    >
      <HeartIcon filled={on} />
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M12 20s-7.2-4.35-9.3-8.1C1.1 9.2 2.2 6 5.4 6c1.9 0 3.1 1.1 3.8 2.2C10 7.1 11.2 6 13.1 6c3.2 0 4.3 3.2 2.7 5.9C13.7 15.65 12 20 12 20z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

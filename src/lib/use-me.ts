"use client";

import { useEffect, useState } from "react";
import type { Viewer } from "@/lib/entitlements";

export const GUEST_VIEWER: Viewer = {
  signedIn: false,
  isAdmin: false,
  isPro: false,
  watchUnlimited: false,
  canFavorite: false,
  canDownload: false,
  downloadsRemaining: null,
  nextDownloadAt: null,
  stripeReady: false,
  authReady: false,
  email: null,
  name: null,
  appUserId: null,
};

export type MePayload = {
  viewer: Viewer;
  favoriteClipIds: string[];
};

let cached: MePayload | null = null;
let inflight: Promise<MePayload> | null = null;

async function fetchMe(): Promise<MePayload> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch("/api/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load account");
        }
        const data = (await response.json()) as MePayload;
        cached = {
          viewer: { ...GUEST_VIEWER, ...data.viewer },
          favoriteClipIds: Array.isArray(data.favoriteClipIds) ? data.favoriteClipIds : [],
        };
        return cached;
      })
      .catch(() => cached ?? { viewer: GUEST_VIEWER, favoriteClipIds: [] })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useMe() {
  const [data, setData] = useState<MePayload>(
    () => cached ?? { viewer: GUEST_VIEWER, favoriteClipIds: [] },
  );
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((next) => {
      if (!cancelled) {
        setData(next);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, ready };
}

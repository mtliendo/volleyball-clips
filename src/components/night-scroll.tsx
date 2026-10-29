"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const STICKY_NAV = 56;
const EDGE_GAP = 12;

let pendingRevealDay: string | null = null;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function revealElement(el: HTMLElement, { focus = false } = {}) {
  const top = window.scrollY + el.getBoundingClientRect().top - STICKY_NAV - EDGE_GAP;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
  if (focus) {
    el.focus({ preventScroll: true });
  }
}

function revealSessions() {
  const heading = document.getElementById("night-sessions");
  if (heading instanceof HTMLElement) {
    revealElement(heading, { focus: true });
  }
}

export function NightScroll({
  selectedDay,
  sessionDays,
}: {
  selectedDay?: string;
  sessionDays: string[];
}) {
  const urlDay = useSearchParams().get("d");

  useEffect(() => {
    const sessionSet = new Set(sessionDays);

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const openNight = target.closest('a[href="#nights"]');
      if (openNight) {
        const nights = document.getElementById("nights");
        if (!nights) {
          return;
        }
        event.preventDefault();
        revealElement(nights);
        history.replaceState(null, "", "#nights");
        return;
      }

      const dayLink = target.closest("a[data-night-day]");
      if (!(dayLink instanceof HTMLElement)) {
        return;
      }
      const day = dayLink.dataset.nightDay;
      if (!day || !sessionSet.has(day)) {
        return;
      }

      pendingRevealDay = day;
      if (day === selectedDay) {
        revealSessions();
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [selectedDay, sessionDays]);

  useEffect(() => {
    if (!pendingRevealDay) {
      return;
    }
    if (pendingRevealDay !== selectedDay && pendingRevealDay !== urlDay) {
      return;
    }

    const timers = [0, 80, 200].map((ms) =>
      window.setTimeout(() => {
        revealSessions();
        if (ms === 200) {
          pendingRevealDay = null;
        }
      }, ms),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [selectedDay, urlDay]);

  return null;
}

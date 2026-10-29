"use client";

import { useEffect, useRef } from "react";

const STICKY_NAV = 56;
const EDGE_GAP = 12;

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

export function NightScroll({
  selectedDay,
  sessionDays,
}: {
  selectedDay?: string;
  sessionDays: string[];
}) {
  const pendingDay = useRef<string | null>(null);
  const sessionSet = useRef(new Set(sessionDays));
  sessionSet.current = new Set(sessionDays);

  useEffect(() => {
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
      if (!day || !sessionSet.current.has(day)) {
        return;
      }

      pendingDay.current = day;
      if (day === selectedDay) {
        const heading = document.getElementById("night-sessions");
        if (heading instanceof HTMLElement) {
          revealElement(heading, { focus: true });
        }
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [selectedDay]);

  useEffect(() => {
    if (!selectedDay || pendingDay.current !== selectedDay) {
      return;
    }

    pendingDay.current = null;
    const heading = document.getElementById("night-sessions");
    if (!(heading instanceof HTMLElement)) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        revealElement(heading, { focus: true });
      });
    });
  }, [selectedDay]);

  return null;
}

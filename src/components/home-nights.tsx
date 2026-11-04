"use client";

import { TZDate } from "@date-fns/tz";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GameList } from "@/components/game-list";
import { MonthCalendar } from "@/components/month-calendar";
import { NightScroll } from "@/components/night-scroll";
import {
  APP_TIMEZONE,
  dayKey,
  formatGameDay,
  latestSessionDay,
  parseYearMonth,
} from "@/lib/dates";
import type { PublicGame } from "@/lib/queries";

function asGame(game: PublicGame): PublicGame {
  return {
    ...game,
    startsAt: game.startsAt instanceof Date ? game.startsAt : new Date(game.startsAt),
  };
}

function HomeNightsInner({
  initialYm,
  initialGames,
  initialSelectedDay,
  ym: urlYm,
  d: urlDay,
}: {
  initialYm: string;
  initialGames: PublicGame[];
  initialSelectedDay?: string;
  ym: string | null;
  d: string | null;
}) {
  const requestedYm = urlYm && /^\d{4}-\d{2}$/.test(urlYm) ? urlYm : initialYm;
  const explicitDay = urlDay && /^\d{4}-\d{2}-\d{2}$/.test(urlDay) ? urlDay : undefined;
  const [gamesByYm, setGamesByYm] = useState<Record<string, PublicGame[]>>(() => ({
    [initialYm]: initialGames.map(asGame),
  }));
  const serverKey = `${initialYm}:${initialGames.map((game) => game.id).join(",")}`;
  const [seededKey, setSeededKey] = useState(serverKey);
  if (seededKey !== serverKey) {
    setSeededKey(serverKey);
    setGamesByYm((prev) => ({ ...prev, [initialYm]: initialGames.map(asGame) }));
  }

  useEffect(() => {
    if (requestedYm === initialYm || gamesByYm[requestedYm]) {
      return;
    }

    let cancelled = false;
    void fetch(`/api/public/month?ym=${encodeURIComponent(requestedYm)}`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { games?: PublicGame[] };
        if (cancelled || !Array.isArray(data.games)) return;
        setGamesByYm((prev) => ({ ...prev, [requestedYm]: data.games!.map(asGame) }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [gamesByYm, initialYm, requestedYm]);

  const yearMonth = useMemo(() => parseYearMonth(requestedYm), [requestedYm]);
  const games = useMemo(
    () => gamesByYm[requestedYm] ?? [],
    [gamesByYm, requestedYm],
  );
  const sessionDays = useMemo(
    () => [...new Set(games.map((game) => dayKey(game.startsAt)))],
    [games],
  );
  const selectedDay =
    explicitDay ??
    (requestedYm === initialYm ? initialSelectedDay : undefined) ??
    latestSessionDay(sessionDays);
  const dayGames = selectedDay
    ? games.filter((game) => dayKey(game.startsAt) === selectedDay)
    : [];

  return (
    <>
      <NightScroll selectedDay={selectedDay} sessionDays={sessionDays} />
      <div className="container space-y-6 pt-10 pb-[calc(var(--space-2xl)+env(safe-area-inset-bottom,0px))]">
        <MonthCalendar
          yearMonth={yearMonth}
          selectedDay={selectedDay}
          games={games.map((game) => ({ id: game.id, day: dayKey(game.startsAt) }))}
        />
        {selectedDay ? (
          <section className="max-md:min-h-[calc(100svh-5.5rem)] space-y-3">
            <h2
              id="night-sessions"
              tabIndex={-1}
              className="display text-section"
            >
              {formatGameDay(
                new TZDate(
                  Number(selectedDay.slice(0, 4)),
                  Number(selectedDay.slice(5, 7)) - 1,
                  Number(selectedDay.slice(8, 10)),
                  12,
                  APP_TIMEZONE,
                ),
              )}
            </h2>
            <GameList games={dayGames} emptyLabel="No sessions on this day." />
          </section>
        ) : (
          <p className="text-center text-sm text-muted">Select a day to list its sessions.</p>
        )}
      </div>
    </>
  );
}

export function HomeNights(props: {
  initialYm: string;
  initialGames: PublicGame[];
  initialSelectedDay?: string;
}) {
  const search = useSearchParams();
  return (
    <HomeNightsInner
      {...props}
      ym={search.get("ym")}
      d={search.get("d")}
    />
  );
}

export function HomeNightsFallback(props: {
  initialYm: string;
  initialGames: PublicGame[];
  initialSelectedDay?: string;
}) {
  return <HomeNightsInner {...props} ym={null} d={null} />;
}

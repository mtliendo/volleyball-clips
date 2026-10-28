import { TZDate } from "@date-fns/tz";
import Link from "next/link";
import { connection } from "next/server";
import { GameList } from "@/components/game-list";
import { MonthCalendar } from "@/components/month-calendar";
import { cdnUrl } from "@/lib/cdn";
import { APP_TIMEZONE, dayKey, formatGameDay, parseYearMonth } from "@/lib/dates";
import { listMonthGames, listRecentReadyPosters } from "@/lib/queries";

const TAPE = ["open gym", "league", "tournament", "spike", "dig", "rally"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; d?: string }>;
}) {
  const { ym, d } = await searchParams;
  if (!ym) {
    await connection();
  }
  const yearMonth = parseYearMonth(ym);
  const [games, posters] = await Promise.all([
    listMonthGames(yearMonth),
    listRecentReadyPosters(6),
  ]);
  const selectedDay = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
  const dayGames = selectedDay
    ? games.filter((game) => dayKey(game.startsAt) === selectedDay)
    : [];

  return (
    <>
      <section className="hero-court">
        {posters.length > 0 ? (
          <ul className="hero-stack">
            {posters.map((poster) => {
              const src = cdnUrl(poster.posterKey);
              return (
                <li key={poster.id} className="min-w-0 shrink-0">
                  <Link
                    href={`/games/${poster.gameId}/watch/${poster.id}`}
                    className="poster-frame"
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="hero-copy container space-y-5">
          <h1 className="display text-display">Clips from the glasses</h1>
          <p className="lead">
            Pick a night. Open a session. Swipe the clips.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="#nights" className="btn btn-primary">
              Open a night
            </a>
            <Link href="/pricing" className="btn btn-ghost">
              Pricing
            </Link>
          </div>
        </div>
      </section>

      <div className="tape">
        <div className="tape-track px-4 py-3 text-sm text-muted">
          {[...TAPE, ...TAPE].map((word, index) => (
            <span key={`${word}-${index}`}>{word}</span>
          ))}
        </div>
      </div>

      <div id="nights" className="container space-y-6 pt-10">
        <MonthCalendar
          yearMonth={yearMonth}
          selectedDay={selectedDay}
          games={games.map((game) => ({ id: game.id, day: dayKey(game.startsAt) }))}
        />
        {selectedDay ? (
          <section className="space-y-3">
            <h2 className="display text-section">
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

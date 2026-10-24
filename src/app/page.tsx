import { TZDate } from "@date-fns/tz";
import { connection } from "next/server";
import { GameList } from "@/components/game-list";
import { MonthCalendar } from "@/components/month-calendar";
import { APP_TIMEZONE, dayKey, formatGameDay, parseYearMonth } from "@/lib/dates";
import { listMonthGames } from "@/lib/queries";

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
  const games = await listMonthGames(yearMonth);
  const selectedDay =
    d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
  const dayGames = selectedDay
    ? games.filter((game) => dayKey(game.startsAt) === selectedDay)
    : [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Meta-glasses volleyball, filed by day. Tap a date with a mark to see that
        night&apos;s games.
      </p>
      <MonthCalendar
        yearMonth={yearMonth}
        selectedDay={selectedDay}
        games={games.map((game) => ({ id: game.id, day: dayKey(game.startsAt) }))}
      />
      {selectedDay ? (
        <section className="space-y-3">
          <h2 className="display text-3xl">
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
          <GameList
            games={dayGames}
            emptyLabel="No games on this day."
          />
        </section>
      ) : (
        <p className="text-center text-sm text-muted">
          Select a day to list its games.
        </p>
      )}
    </div>
  );
}

import Link from "next/link";
import {
  adjacentMonth,
  calendarGrid,
  dayKey,
  formatMonthTitle,
  yearMonthKey,
} from "@/lib/dates";

type GameMarker = {
  id: string;
  day: string;
};

export function MonthCalendar({
  yearMonth,
  selectedDay,
  games,
}: {
  yearMonth: Date;
  selectedDay?: string;
  games: GameMarker[];
}) {
  const days = calendarGrid(yearMonth);
  const currentMonth = yearMonth.getMonth();
  const ym = yearMonthKey(yearMonth);
  const prev = yearMonthKey(adjacentMonth(yearMonth, -1));
  const next = yearMonthKey(adjacentMonth(yearMonth, 1));
  const daysWithGames = new Set(games.map((game) => game.day));

  return (
    <section className="rounded-3xl border border-line bg-panel p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/?ym=${prev}`}
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-lg text-muted hover:text-foreground"
          aria-label="Previous month"
        >
          ‹
        </Link>
        <h1 className="display text-3xl">{formatMonthTitle(yearMonth)}</h1>
        <Link
          href={`/?ym=${next}`}
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-lg text-muted hover:text-foreground"
          aria-label="Next month"
        >
          ›
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[0.18em] text-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((date) => {
          const key = dayKey(date);
          const inMonth = date.getMonth() === currentMonth;
          const selected = selectedDay === key;
          const hasGames = daysWithGames.has(key);

          return (
            <Link
              key={key}
              href={`/?ym=${ym}&d=${key}`}
              className={`flex min-h-11 flex-col items-center justify-center rounded-2xl text-sm ${
                selected
                  ? "bg-court text-background"
                  : inMonth
                    ? "bg-panel-2 text-foreground"
                    : "text-muted/50"
              }`}
            >
              <span>{date.getDate()}</span>
              {hasGames ? (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    selected ? "bg-background" : "bg-court"
                  }`}
                />
              ) : (
                <span className="mt-0.5 h-1.5 w-1.5" />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

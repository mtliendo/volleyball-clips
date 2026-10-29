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
    <section id="nights" className="well p-4">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/?ym=${prev}`}
          className="icon-btn"
          aria-label="Previous month"
        >
          ‹
        </Link>
        <h2 className="display text-section">{formatMonthTitle(yearMonth)}</h2>
        <Link
          href={`/?ym=${next}`}
          className="icon-btn"
          aria-label="Next month"
        >
          ›
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
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
              scroll={false}
              data-night-day={key}
              aria-current={selected ? "date" : undefined}
              aria-label={hasGames ? `${date.getDate()}, sessions` : undefined}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-card text-sm ${
                selected
                  ? "bg-accent text-accent-ink"
                  : hasGames
                    ? inMonth
                      ? "bg-paper-3 text-ink ring-1 ring-spark/80"
                      : "bg-paper-3/70 text-muted ring-1 ring-spark/40"
                    : inMonth
                      ? "text-muted"
                      : "text-muted/40"
              }`}
            >
              <span>{date.getDate()}</span>
              <span
                className={`mt-0.5 h-1.5 w-1.5 rounded-pill ${
                  hasGames ? (selected ? "bg-accent-ink" : "bg-spark") : "invisible"
                }`}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

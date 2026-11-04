import Link from "next/link";
import { TrackLink } from "@/components/track-click";
import { HomeNights } from "@/components/home-nights";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { cdnUrl } from "@/lib/cdn";
import { latestSessionDay, dayKey, parseYearMonth, yearMonthKey } from "@/lib/dates";
import { getCachedMonthGames, getCachedRecentPosters } from "@/lib/public-data";

const TAPE = ["open gym", "league", "tournament", "spike", "dig", "rally"];

export const dynamic = "force-static";
export const revalidate = 900;

export default async function HomePage() {
  const yearMonth = parseYearMonth();
  const [{ games }, posters] = await Promise.all([
    getCachedMonthGames(yearMonthKey(yearMonth)),
    getCachedRecentPosters(6),
  ]);
  const sessionDays = [...new Set(games.map((game) => dayKey(game.startsAt)))];
  const selectedDay = latestSessionDay(sessionDays);
  const nightsProps = {
    initialYm: yearMonthKey(yearMonth),
    initialGames: games,
    initialSelectedDay: selectedDay,
  };

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
            <TrackLink href="/pricing" event={ANALYTICS_EVENTS.goProClick} className="btn btn-ghost">
              Pricing
            </TrackLink>
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

      <HomeNights {...nightsProps} />
    </>
  );
}

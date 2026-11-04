import { NextResponse } from "next/server";
import { getCachedMonthGames } from "@/lib/public-data";

export const revalidate = 900;

export async function GET(request: Request) {
  const ym = new URL(request.url).searchParams.get("ym") ?? undefined;
  if (ym && !/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: "Invalid ym" }, { status: 400 });
  }

  const { ym: resolved, games } = await getCachedMonthGames(ym);
  return NextResponse.json({
    ym: resolved,
    games: games.map((game) => ({
      ...game,
      startsAt: game.startsAt.toISOString(),
    })),
  });
}

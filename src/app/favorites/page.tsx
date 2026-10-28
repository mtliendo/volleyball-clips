import Link from "next/link";
import { requireUserPage } from "@/lib/admin";
import { cdnUrl } from "@/lib/cdn";
import { formatGameWhen } from "@/lib/dates";
import { getViewer } from "@/lib/entitlements";
import { PIN_LABEL_COPY } from "@/lib/labels";
import { listFavoriteClips } from "@/lib/queries";
import { ensureAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const session = await requireUserPage("/favorites");
  const appUser = await ensureAppUser(session.user);
  const viewer = await getViewer();
  const clips = appUser ? await listFavoriteClips(appUser.id) : [];

  return (
    <div className="container space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="display text-display-s">My favorites</h1>
        <p className="lead">Clips you hearted, ready to open in their session feed.</p>
        {viewer.downloadsRemaining !== null ? (
          <p className="meta">{viewer.downloadsRemaining} downloads left this week</p>
        ) : null}
      </header>
      {clips.length === 0 ? (
        <p className="well px-4 py-10 text-center text-sm text-muted">
          No favorites yet. Open a session and tap the heart.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {clips.map((clip) => {
            const poster = cdnUrl(clip.posterKey);
            const href = `/games/${clip.gameId}/watch/${clip.id}`;
            return (
              <li key={clip.id} className="min-w-0">
                <Link href={href} className="block space-y-2">
                  <div className="poster-frame relative aspect-[9/16]">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt="" />
                    ) : null}
                    {clip.pin?.label ? (
                      <span className="chip-spark absolute top-2 left-2">
                        {PIN_LABEL_COPY[clip.pin.label]}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm">{clip.venueName}</p>
                  <p className="meta">{formatGameWhen(clip.startsAt)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

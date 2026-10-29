import { FavoritesGrid } from "@/components/favorites-grid";
import { requireUserPage } from "@/lib/admin";
import { getViewer } from "@/lib/entitlements";
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
        <p className="lead">Clips you saved. Tap one to open it in the feed.</p>
        {viewer.downloadsRemaining !== null ? (
          <p className="meta">{viewer.downloadsRemaining} downloads left this week</p>
        ) : null}
      </header>
      {clips.length === 0 ? (
        <p className="well px-4 py-10 text-center text-sm text-muted">
          No favorites yet. Open a session and tap the heart.
        </p>
      ) : (
        <FavoritesGrid clips={clips} viewer={viewer} />
      )}
    </div>
  );
}

import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";

export default async function AdminHomePage() {
  const session = await requireAdminPage("/admin");

  return (
    <div className="space-y-4">
      <h1 className="display text-4xl">Admin</h1>
      <p className="text-sm text-muted">
        Signed in as {session.user.email ?? session.user.name}. Only users with
        the Auth0 <code>admin</code> role can manage clips.
      </p>
      <div className="grid gap-3">
        <Link href="/admin/games/new" className="rounded-3xl bg-court px-4 py-4 text-background">
          Create a game
        </Link>
        <Link href="/admin/games" className="rounded-3xl border border-line bg-panel px-4 py-4">
          Manage games and uploads
        </Link>
        <Link href="/admin/venues" className="rounded-3xl border border-line bg-panel px-4 py-4">
          Venues
        </Link>
        <Link href="/admin/tags" className="rounded-3xl border border-line bg-panel px-4 py-4">
          Tags
        </Link>
      </div>
    </div>
  );
}

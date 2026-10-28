import Link from "next/link";
import { getSession } from "@/lib/admin";

export default async function NotAuthorizedPage() {
  const session = await getSession();

  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="display text-4xl">Not authorized</h1>
      <p className="text-sm text-muted">
        {session
          ? "Your account does not have the admin role needed to manage clips."
          : "You need an admin account to manage clips."}
      </p>
      <Link href="/" className="text-sm text-court">
        Back to the calendar
      </Link>
    </div>
  );
}

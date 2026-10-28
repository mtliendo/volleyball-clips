import Link from "next/link";

export default function NotAuthorizedPage() {
  return (
    <div className="container space-y-4 py-16">
      <h1 className="display text-display-s">Not an admin</h1>
      <p className="lead">
        You need the admin role to upload or manage clips. Your account can
        still watch, favorite, and download.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="btn btn-primary">
          Back to nights
        </Link>
        <Link href="/favorites" className="btn btn-ghost">
          My favorites
        </Link>
      </div>
    </div>
  );
}

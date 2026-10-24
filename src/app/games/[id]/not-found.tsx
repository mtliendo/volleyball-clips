import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="display text-4xl">Game not found</h1>
      <p className="text-sm text-muted">
        That game is not on the calendar.
      </p>
      <Link href="/" className="text-sm text-court">
        Back to the calendar
      </Link>
    </div>
  );
}

import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="container space-y-3 py-16">
      <h1 className="display text-display-s">Session not found</h1>
      <p className="lead">That session is not on the calendar.</p>
      <Link href="/" className="btn btn-primary">
        Back to the nights
      </Link>
    </div>
  );
}

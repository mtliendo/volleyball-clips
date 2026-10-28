import { authLoginHref } from "@/lib/auth-urls";

export function SignupWall({ returnTo }: { returnTo: string }) {
  return (
    <div className="flex min-h-full flex-col justify-end bg-paper/92 p-5" data-signup-wall="">
      <div className="mx-auto w-full max-w-sm space-y-4">
        <h2 className="display text-section">That is seven for today</h2>
        <p className="lead">
          Make a free account to keep watching and to save favorites.
        </p>
        <div className="flex flex-col gap-2">
          <a href={authLoginHref({ returnTo, signup: true })} className="btn btn-primary">
            Make a free account
          </a>
          <a href={authLoginHref({ returnTo })} className="btn btn-ghost">
            Sign in
          </a>
          <a href={returnTo.replace(/\/watch\/[^/?]+/, "")} className="btn btn-ghost">
            Back to the session
          </a>
        </div>
      </div>
    </div>
  );
}

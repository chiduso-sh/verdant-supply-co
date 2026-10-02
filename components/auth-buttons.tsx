import { signIn, signOut } from "@/auth";

export function SignInButton({
  redirectTo = "/",
  label = "Sign in with Google",
  className = "",
}: {
  redirectTo?: string;
  label?: string;
  className?: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo });
      }}
    >
      <button
        type="submit"
        className={
          className ||
          "group inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-sm font-medium text-white shadow-[0_2px_10px_-4px_rgba(47,93,74,0.6)] transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:bg-leaf-dark hover:shadow-[0_10px_24px_-10px_rgba(47,93,74,0.85)] active:translate-y-0 active:scale-[0.98]"
        }
      >
        <GoogleMark />
        {label}
      </button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="text-sm text-ink-faint transition-colors duration-200 hover:text-ink"
      >
        Sign out
      </button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:rotate-[14deg]"
    >
      <path
        fill="#fff"
        d="M12 11v2.8h6.6c-.3 1.7-2 5-6.6 5a7 7 0 0 1 0-14c2 0 3.4.8 4.2 1.6l2.3-2.2A9.6 9.6 0 0 0 12 1.6a10.4 10.4 0 0 0 0 20.8c6 0 10-4.2 10-10.1 0-.6-.1-1-.2-1.3H12Z"
      />
    </svg>
  );
}

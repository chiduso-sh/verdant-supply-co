import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "./auth-buttons";
import { CartBadge } from "./cart-badge";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="group">
          <span className="block font-serif text-xl tracking-tight text-ink">
            Verdant Supply Co.
          </span>
          <span className="block text-xs text-ink-faint">
            plants · vessels · care
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {session?.user ? (
            <>
              <Link
                href="/orders"
                className="text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
              >
                Orders
              </Link>
              <SignOutButton />
            </>
          ) : (
            <SignInButton />
          )}
          <CartBadge />
        </nav>
      </div>
    </header>
  );
}

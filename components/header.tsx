import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "./auth-buttons";
import { CartBadge } from "./cart-badge";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-paper/80 backdrop-blur-md supports-[backdrop-filter]:bg-paper/65">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="group -m-1 rounded-lg p-1">
          <span className="flex items-baseline gap-2">
            <span className="font-serif text-xl tracking-tight text-ink transition-colors duration-300 group-hover:text-leaf">
              Verdant Supply Co.
            </span>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-leaf opacity-0 transition-all duration-300 group-hover:opacity-100"
            />
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
                className="relative text-sm text-ink-soft transition-colors duration-200 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 after:ease-[var(--ease-out-soft)] hover:text-ink hover:after:origin-left hover:after:scale-x-100"
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

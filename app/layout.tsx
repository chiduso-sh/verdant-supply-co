import type { Metadata } from "next";
import Link from "next/link";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdant Supply Co. — plants, vessels, care",
  description:
    "A small demo shop: houseplants, hand-thrown vessels, and the tools to keep them alive.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink antialiased">
        <CartProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl px-4 pb-28 sm:px-6">
            {children}
          </main>

          <footer className="border-t border-line">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
              <div>
                <p className="font-serif text-lg text-ink">
                  Verdant Supply Co.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                  A demo build. No payment is taken and nothing ships.
                </p>
              </div>
              <div className="flex items-center gap-5 text-sm text-ink-faint">
                <Link
                  href="/"
                  className="transition-colors duration-200 hover:text-ink"
                >
                  Shop
                </Link>
                <Link
                  href="/cart"
                  className="transition-colors duration-200 hover:text-ink"
                >
                  Cart
                </Link>
                <Link
                  href="/orders"
                  className="transition-colors duration-200 hover:text-ink"
                >
                  Orders
                </Link>
              </div>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}

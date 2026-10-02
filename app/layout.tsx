import type { Metadata } from "next";
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
      <body className="bg-paper text-ink">
        <CartProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-line px-4 py-8 text-center text-xs text-ink-faint sm:px-6">
            Verdant Supply Co. — a demo build. No payment is taken and nothing
            ships.
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}

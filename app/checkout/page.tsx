import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { CheckoutForm } from "@/components/checkout-form";

export default async function CheckoutPage() {
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <div className="mx-auto max-w-md pt-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Sign in to check out</h1>
        <p className="mt-3 text-ink-soft">
          Your cart is saved. We need a Google account so we know where to send
          your confirmation email.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton redirectTo="/checkout" />
        </div>
      </div>
    );
  }

  return (
    <CheckoutForm
      userName={session.user.name ?? null}
      userEmail={session.user.email}
    />
  );
}

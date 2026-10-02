import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const session = await auth();
  const { redirectTo } = await searchParams;
  const target = redirectTo ?? "/";

  if (session?.user) redirect(target);

  return (
    <div className="mx-auto max-w-md pt-24 text-center">
      <h1 className="font-serif text-3xl text-ink">Sign in</h1>
      <p className="mt-3 text-ink-soft">
        We use Google so you don&apos;t have to invent another password. Your
        order confirmation goes to that Google address.
      </p>
      <div className="mt-8 flex justify-center">
        <SignInButton redirectTo={target} />
      </div>
    </div>
  );
}

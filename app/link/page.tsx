import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton } from "@/components/auth-buttons";
import { LinkDeviceForm } from "@/components/link-device-form";
import { listDeviceSessions } from "@/lib/server/device-auth";

export const metadata = {
  title: "Link a device — Verdant Supply Co.",
};

/**
 * Where a phone gets signed in.
 *
 * The app shows a code; this page takes it and attaches it to the browser's
 * existing Google session. Nothing about Google happens on the phone, which
 * is why no second OAuth client and no extra authorized redirect URI are
 * needed for the mobile app to work.
 */
export default async function LinkPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const session = await auth();
  const { code = "" } = await searchParams;

  if (!session?.user?.id || !session.user.email) {
    // Round-trip the code through the sign-in so it is still in the field
    // when they land back here.
    const back = code ? `/link?code=${encodeURIComponent(code)}` : "/link";

    return (
      <div className="mx-auto max-w-md pt-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Link a device</h1>
        <p className="mt-3 text-ink-soft">
          Sign in on this browser first. Then the code from your app can be
          attached to your account.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton redirectTo={back} />
        </div>
      </div>
    );
  }

  const devices = await listDeviceSessions(session.user.id);

  return (
    <div className="mx-auto max-w-md pt-12">
      <h1 className="animate-[var(--animate-fade-up)] font-serif text-3xl text-ink">
        Link a device
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-faint">
        Open the Verdant app, tap <em>Sign in</em>, and type the eight
        characters it shows you here.
      </p>

      <div className="mt-8">
        <LinkDeviceForm initialCode={code} userEmail={session.user.email} />
      </div>

      {devices.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Linked devices
          </h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {devices.map((device) => (
              <li key={device.id} className="px-4 py-3">
                <p className="text-sm text-ink">
                  {device.deviceName ?? "Unnamed device"}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Linked{" "}
                  {new Date(device.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {device.lastUsedAt
                    ? ` · last used ${new Date(
                        device.lastUsedAt,
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                      })}`
                    : " · not used yet"}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            Sign out from inside the app to remove a device.
          </p>
        </section>
      ) : null}

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-ink-faint underline-offset-4 transition-colors duration-200 hover:text-ink hover:underline"
      >
        Back to shop
      </Link>
    </div>
  );
}

export const dynamic = "force-dynamic";

"use client";

import { useActionState } from "react";
import { respondToDevice, type LinkState } from "@/app/link/actions";
import { USER_CODE_LENGTH } from "@/lib/tokens";

const IDLE: LinkState = { status: "idle" };

/**
 * The approval form for a device pairing.
 *
 * Both buttons submit the same form and differ only in the `intent` they
 * carry, so the code being acted on is always the one in the field the person
 * is looking at.
 *
 * `useActionState` keeps the outcome inline rather than bouncing through a
 * redirect, which matters because the next step happens on a different
 * device — the person needs to read "approved" here and then pick their phone
 * back up.
 */
export function LinkDeviceForm({
  initialCode,
  userEmail,
}: {
  initialCode: string;
  userEmail: string;
}) {
  const [state, respond, busy] = useActionState(respondToDevice, IDLE);

  if (state.status === "approved") {
    return (
      <div className="animate-[var(--animate-rise)] rounded-2xl border border-leaf/30 bg-leaf/5 p-6 text-center">
        <span className="mx-auto flex h-14 w-14 animate-[var(--animate-badge-pop)] items-center justify-center rounded-full bg-leaf">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-7 w-7 text-white"
          >
            <path
              d="m4 12 5 5L20 6"
              strokeDasharray="48"
              className="animate-[var(--animate-draw)]"
            />
          </svg>
        </span>
        <h2 className="mt-4 font-serif text-2xl text-leaf">Device approved</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
          {state.deviceName ? (
            <>
              <strong className="text-ink">{state.deviceName}</strong> is now
              signed in as{" "}
            </>
          ) : (
            <>That device is now signed in as </>
          )}
          <strong className="text-ink">{userEmail}</strong>. Go back to the app
          — it should pick this up within a couple of seconds.
        </p>
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center">
        <h2 className="font-serif text-2xl text-ink">Declined</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Nothing was signed in. The app will say the pairing was refused.
        </p>
      </div>
    );
  }

  return (
    <form action={respond} className="rounded-2xl border border-line bg-card p-6">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ink-soft">
          Code from the app
        </span>
        <input
          name="code"
          defaultValue={initialCode}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-EFGH"
          // Length plus the dash. The server normalizes anyway, so this is a
          // nudge rather than validation.
          maxLength={USER_CODE_LENGTH + 1}
          className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-center font-mono text-xl uppercase tracking-[0.25em] text-ink outline-none transition-all duration-200 placeholder:tracking-[0.2em] placeholder:text-ink-faint/50 hover:border-ink-faint/50 focus:border-leaf focus:bg-card focus:ring-2 focus:ring-leaf/15"
        />
      </label>

      {state.status === "error" ? (
        <p
          role="alert"
          className="mt-4 animate-[var(--animate-fade-up)] rounded-xl border border-ochre/40 bg-ochre/5 p-3 text-sm text-ochre"
        >
          {state.error}
        </p>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-ink-faint">
        Approving signs that device in as{" "}
        <strong className="text-ink-soft">{userEmail}</strong>. It will be able
        to see your cart and your orders, and to place new ones. Only approve a
        code you are looking at right now on your own device.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          name="intent"
          value="approve"
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-leaf px-6 py-3 text-sm font-medium text-white shadow-[0_2px_12px_-4px_rgba(47,93,74,0.6)] transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:bg-leaf-dark hover:shadow-[0_14px_30px_-12px_rgba(47,93,74,0.9)] active:translate-y-0 active:scale-[0.99] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
        >
          {busy ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
              />
              Working&hellip;
            </>
          ) : (
            "Approve this device"
          )}
        </button>
        <button
          type="submit"
          name="intent"
          value="decline"
          disabled={busy}
          className="rounded-full border border-line px-5 py-3 text-sm text-ink-faint transition-colors duration-200 hover:border-ochre/40 hover:text-ochre disabled:cursor-not-allowed disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </form>
  );
}

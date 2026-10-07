/**
 * Sign-in state for the app.
 *
 * The flow is RFC 8628's device-authorization grant:
 *
 *   1. The app asks the server to open a pairing and gets back a short code.
 *   2. The person opens /link in a browser — where the website's existing
 *      Google session already works — and types the code.
 *   3. The app, which has been polling, receives a bearer token.
 *
 * Google is never touched on the device. That is the point: no second OAuth
 * client, and no new authorized redirect URI to register for every origin the
 * app is served from, which is the usual reason device login fails while
 * desktop works.
 */

import Constants from "expo-constants";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import {
  ApiError,
  fetchMe,
  pollPairing,
  signOutDevice,
  startPairing,
  type Me,
  type StartedPairing,
} from "./api";
import { clearToken, readToken, writeToken } from "./storage";

export type AuthUser = Me["user"];

export type PairingState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "waiting"; pairing: StartedPairing }
  | { phase: "error"; error: string };

type AuthContextValue = {
  /** "loading" only while the stored token is being checked on launch. */
  status: "loading" | "signedOut" | "signedIn";
  user: AuthUser | null;
  token: string | null;
  pairing: PairingState;
  beginPairing: () => void;
  cancelPairing: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** A label the person will recognise in the website's linked-devices list. */
function deviceLabel(): string {
  const name = Constants.deviceName?.trim();
  const platform =
    Platform.OS === "ios"
      ? "iOS"
      : Platform.OS === "android"
        ? "Android"
        : "Web";

  return name ? `${name} (${platform})` : `Verdant app on ${platform}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingState>({ phase: "idle" });

  /**
   * Set while a pairing is being polled, and cleared to stop it.
   *
   * A ref rather than state because the polling loop has to read the current
   * value on every tick; state would close over a stale copy and the loop
   * would never notice a cancellation.
   */
  const polling = useRef<string | null>(null);

  /* ---------- Launch: is the stored token still good? ---------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await readToken();

      if (!stored) {
        if (!cancelled) setStatus("signedOut");
        return;
      }

      try {
        const me = await fetchMe(stored);
        if (cancelled) return;
        setToken(stored);
        setUser(me.user);
        setStatus("signedIn");
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiError && error.isAuthFailure) {
          // Expired or revoked from the website. Drop it and ask to pair again.
          await clearToken();
          setStatus("signedOut");
          return;
        }

        // Offline, or the server is down. Keep the token and stay signed in:
        // throwing someone out of the app because the network blipped would
        // make them re-pair for no reason.
        setToken(stored);
        setStatus("signedIn");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- Pairing ---------- */

  const cancelPairing = useCallback(() => {
    polling.current = null;
    setPairing({ phase: "idle" });
  }, []);

  const beginPairing = useCallback(() => {
    setPairing({ phase: "starting" });

    (async () => {
      let started: StartedPairing;
      try {
        started = await startPairing(deviceLabel());
      } catch (error) {
        setPairing({
          phase: "error",
          error:
            error instanceof ApiError
              ? error.message
              : "Could not start sign-in. Try again.",
        });
        return;
      }

      polling.current = started.deviceCode;
      setPairing({ phase: "waiting", pairing: started });

      const intervalMs = Math.max(1, started.intervalSeconds) * 1000;
      const deadline = new Date(started.expiresAt).getTime();

      while (polling.current === started.deviceCode) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        if (polling.current !== started.deviceCode) return;

        if (Date.now() > deadline) {
          polling.current = null;
          setPairing({
            phase: "error",
            error: "That code expired. Tap sign in to get a new one.",
          });
          return;
        }

        try {
          const result = await pollPairing(started.deviceCode);
          if (result.status === "pending") continue;

          // Approved. Store the token before anything else, so a crash
          // between here and the fetch does not lose it.
          polling.current = null;
          await writeToken(result.token);
          setToken(result.token);

          try {
            const me = await fetchMe(result.token);
            setUser(me.user);
          } catch {
            // The token is good; the profile fetch can be retried later.
          }

          setStatus("signedIn");
          setPairing({ phase: "idle" });
          return;
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;

          // A network blip mid-poll is not a failed pairing — the code is
          // still live on the server, so keep polling.
          if (error.status === 0) continue;

          polling.current = null;
          setPairing({ phase: "error", error: error.message });
          return;
        }
      }
    })();
  }, []);

  /** Stop polling if the app unmounts mid-pairing. */
  useEffect(() => {
    return () => {
      polling.current = null;
    };
  }, []);

  /* ---------- Sign out ---------- */

  const signOut = useCallback(() => {
    const current = token;

    // Local state first: a sign-out should feel instant and must succeed even
    // with no network. The server-side revoke is attempted afterwards.
    polling.current = null;
    setToken(null);
    setUser(null);
    setStatus("signedOut");
    setPairing({ phase: "idle" });

    void clearToken();
    if (current) {
      void signOutDevice(current).catch(() => {
        // Offline. The token still expires on its own, and it can be revoked
        // from the website's linked-devices list.
      });
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        token,
        pairing,
        beginPairing,
        cancelPairing,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

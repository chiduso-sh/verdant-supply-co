/**
 * Where the bearer token is kept.
 *
 * On a device that is the OS keystore (Keychain / Keystore) via
 * expo-secure-store. expo-secure-store has no web implementation, and Expo's
 * web target is how this app gets exercised in a browser during development,
 * so web falls back to localStorage — which is not secure storage and is only
 * acceptable because it is a development target. The distinction is kept
 * explicit rather than hidden behind a polyfill.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "verdant.api.token";

const isWeb = Platform.OS === "web";

export async function readToken(): Promise<string | null> {
  try {
    if (isWeb) return window.localStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // A locked or unavailable keystore reads as "not signed in" rather than
    // crashing the app on launch.
    return null;
  }
}

export async function writeToken(token: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    if (isWeb) {
      window.localStorage.removeItem(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Already gone.
  }
}

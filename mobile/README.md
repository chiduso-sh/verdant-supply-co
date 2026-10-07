# Verdant Supply Co. — mobile app

Expo + React Native. Signs into the same account as the website and shares the
same cart, live.

It talks to the web project **only over HTTP**, through the routes documented in
the [root README](../README.md#the-http-api). The one exception is build-time:
Metro maps `@shop/*` to `../lib/*` so the app imports the web project's pure
modules rather than copying them.

## Run it

```bash
npm install
```

```bash
npm start
```

Then scan the QR code with **Expo Go** ([iOS](https://apps.apple.com/app/expo-go/id982107779),
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)).
No native build and no Xcode or Android Studio required.

Other targets:

```bash
npm run web
```

```bash
npm run typecheck
```

`npm run web` is genuinely useful beyond convenience — it is how the app gets
driven in a browser during development, and it is the reason the API sends CORS
headers at all.

## Which server it talks to

By default: **`https://verdant-supply-co.vercel.app`**, the deployed app.

That default is deliberate. A phone on a different network cannot reach a
laptop's `localhost`, and pointing the app at production avoids a tunnel —
which would in turn mean registering the tunnel URL as an authorized redirect
URI in Google Cloud Console. Testing against production is the shorter path.

To use a local server instead, create `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Anything prefixed `EXPO_PUBLIC_` is inlined into the bundle by Expo. This works
for the web target and for a simulator; a **physical device cannot reach
`localhost`** and needs either your machine's LAN address (and the Next.js dev
server started with `-H 0.0.0.0`) or the production URL.

The sign-in screen prints the URL it is using at the bottom. Check it there
first when something will not connect.

## Signing in

There is no Google button. The app uses a device-pairing flow:

1. Tap **Sign in**, then **Get a sign-in code**. An eight-character code
   appears.
2. Tap **Open the approval page**, or visit `/link` on any browser where you
   are already signed in.
3. Type the code and tap **Approve this device**.
4. The app picks it up within about two seconds.

Google is never touched on the phone. The reasoning, and what that buys, is in
the [root README](../README.md#mobile-authentication).

Sign out from the **Orders** screen. That revokes the token server-side; the
website's `/link` page lists linked devices.

## Layout

```
App.tsx                   Navigation, header, providers
src/api.ts                Every HTTP call, and the only place the token is attached
src/auth.tsx              Pairing flow, token storage, sign-in state
src/cart.tsx              Cart mirror, optimistic edits, 2s version polling
src/storage.ts            Token at rest: Keychain/Keystore on device, localStorage on web
src/theme.ts              Palette, transcribed from the web app's Tailwind tokens
src/components/ui.tsx     Buttons, cards, steppers, price
src/screens/              One file per screen
metro.config.js           The @shop/* -> ../lib/* mapping
```

## Testing on a physical phone

Claude cannot drive a phone, so this part is run by hand. The steps below are
exact; each one has something specific to look for.

**Before you start:** the Google OAuth client is in Testing mode, so the Google
account you use must be listed under *Google Cloud Console → Audience → Test
users*, or sign-in returns `access_denied`.

1. **Install Expo Go** on the phone and put it on any network (it does not have
   to match your laptop's if you are using the production default).
2. On your laptop: `cd mobile && npm start`. Scan the QR code with Expo Go
   (Android) or the Camera app (iOS).
   *Expect:* the shop front, twelve products in three categories, prices
   rendered as `$48.00`.
3. **Pull down to refresh** the catalogue.
   *Expect:* it reloads without an error banner. If you see one, the URL at the
   bottom of the Sign in screen is wrong.
4. Tap **Sign in → Get a sign-in code**.
   *Expect:* an eight-character code like `N7ZU-SVTS`, and "Waiting for
   approval".
5. On your **laptop**, open the same site's `/link`, sign in with Google, type
   the code, tap **Approve this device**.
   *Expect:* "Device approved" on the laptop, and the phone leaving the sign-in
   screen on its own within a couple of seconds. **This is the step that proves
   shared login.**
6. On the phone, open **Cart**.
   *Expect:* whatever is in your cart on the laptop, to the penny.
7. **Laptop:** add a product to the cart. Watch the phone without touching it.
   *Expect:* the phone's cart and the header badge update within about two
   seconds. **This is the step that proves live sync.**
8. **Phone:** change a quantity with the − / + stepper. Watch the laptop.
   *Expect:* the laptop's cart updates within about two seconds, no reload.
9. **Phone:** tap **Checkout**, fill the address (the country list cascades into
   states and, for Nigeria, cities), tap **Place order**.
   *Expect:* an order confirmation screen with an order number like `VS-YETV27`.
10. *Expect:* **the laptop's cart empties on its own**, the order appears on the
    laptop's `/orders` page, and a confirmation email arrives.
11. **Phone:** background the app for a minute, then reopen it.
    *Expect:* still signed in, and the cart reconciles immediately rather than
    waiting for the next poll.
12. **Phone:** Orders → **Sign out**, then reopen the app.
    *Expect:* signed out, and the device gone from the laptop's `/link` list.

If step 5 hangs, the code expired (they last ten minutes) — get a new one. If
step 7 or 8 does not happen, check that both devices are signed into the *same*
Google account; the header on the Orders screen shows which.

## Known limits

- **Sync is a poll, not a push.** Under about two seconds, not instant. See
  [Cart sync](../README.md#cart-sync) for why there is no realtime vendor.
- **Polling pauses when the app is backgrounded**, by design. Reopening the app
  triggers an immediate read rather than waiting for the next tick.
- **On the web target the token is in `localStorage`, not secure storage.**
  `expo-secure-store` has no web implementation. The web target is for
  development only; on a device the token is in the Keychain or Keystore.
- **No tests.** The app is covered by `tsc` and a manual pass.
- **No push notifications, no offline queue, no deep links.** Out of scope.

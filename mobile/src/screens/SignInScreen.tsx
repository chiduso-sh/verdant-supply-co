import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { API_URL } from "../api";
import { useAuth } from "../auth";
import {
  Banner,
  Body,
  Button,
  Card,
  Heading,
  Label,
} from "../components/ui";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

/**
 * Sign-in by device pairing.
 *
 * The app shows a code; the person approves it in a browser where the
 * website's Google session already works. Nothing about Google happens on
 * this device.
 */
export function SignInScreen({ navigation }: Props) {
  const { status, pairing, beginPairing, cancelPairing } = useAuth();
  const [copied, setCopied] = useState(false);

  // Once the pairing lands, this screen has nothing left to say.
  useEffect(() => {
    if (status === "signedIn") navigation.goBack();
  }, [status, navigation]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  // Leaving the screen mid-pairing should stop the polling loop.
  useEffect(() => cancelPairing, [cancelPairing]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={styles.page}
    >
      <Heading>Sign in</Heading>
      <Body muted style={{ marginTop: 8 }}>
        Your cart and orders live on your account, so this app signs in to the
        same one as the website.
      </Body>

      {pairing.phase === "waiting" ? (
        <Card style={{ marginTop: 24 }}>
          <Label>Step 1 — open this page</Label>
          <Button
            label="Open the approval page"
            onPress={() =>
              void WebBrowser.openBrowserAsync(
                pairing.pairing.verificationUriComplete,
              )
            }
            style={{ marginTop: 10 }}
          />
          <Body muted style={{ marginTop: 8 }}>
            Or visit {pairing.pairing.verificationUri} on any browser where you
            are signed in.
          </Body>

          <View style={styles.divider} />

          <Label>Step 2 — enter this code</Label>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy the code ${pairing.pairing.userCode}`}
            onPress={async () => {
              await Clipboard.setStringAsync(pairing.pairing.userCode);
              setCopied(true);
            }}
          >
            <Text style={styles.code}>{pairing.pairing.userCode}</Text>
          </Pressable>
          <Body muted style={{ textAlign: "center" }}>
            {copied ? "Copied" : "Tap to copy"}
          </Body>

          <View style={{ marginTop: 18 }}>
            <Banner tone="good">
              Waiting for approval. This screen updates on its own — leave it
              open.
            </Banner>
          </View>

          <Button
            label="Cancel"
            variant="ghost"
            onPress={cancelPairing}
            style={{ marginTop: 12 }}
          />
        </Card>
      ) : (
        <Card style={{ marginTop: 24 }}>
          {pairing.phase === "error" ? (
            <View style={{ marginBottom: 14 }}>
              <Banner tone="warn">{pairing.error}</Banner>
            </View>
          ) : null}

          <Body>
            Tap below and the app will show you an eight-character code. Type it
            into the website and you are in.
          </Body>
          <Button
            label="Get a sign-in code"
            onPress={beginPairing}
            busy={pairing.phase === "starting"}
            style={{ marginTop: 16 }}
          />
        </Card>
      )}

      <Body muted style={{ marginTop: 22 }}>
        Connected to {API_URL}
      </Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, backgroundColor: colors.paper },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 18,
  },
  code: {
    marginTop: 10,
    marginBottom: 6,
    textAlign: "center",
    fontSize: 34,
    letterSpacing: 6,
    fontVariant: ["tabular-nums"],
    color: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingVertical: 16,
  },
});

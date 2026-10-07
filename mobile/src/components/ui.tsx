/**
 * The small set of presentational pieces every screen reuses.
 *
 * Kept in one file because there are only a handful and they are all a dozen
 * lines; splitting them into a directory would be more navigation than it
 * saves. Styling mirrors the web app's tokens via src/theme.ts.
 */

import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { formatCents } from "@shop/money";
import { colors, radius, serif } from "../theme";

export const fontSerif = Platform.select(serif);

/* ---------- Text ---------- */

export function Heading({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

export function Body({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[styles.body, muted && styles.bodyMuted, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** Integer cents, formatted by the same function the website uses. */
export function Price({
  cents,
  style,
}: {
  cents: number;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.price, style]}>{formatCents(cents)}</Text>;
}

/* ---------- Containers ---------- */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** An inline message. `tone` picks the shop's green or its ochre. */
export function Banner({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn" | "good";
}) {
  const toneStyle =
    tone === "warn"
      ? styles.bannerWarn
      : tone === "good"
        ? styles.bannerGood
        : styles.bannerInfo;

  return (
    <View style={[styles.banner, toneStyle]}>
      <Text
        style={[
          styles.bannerText,
          tone === "warn" && { color: colors.ochre },
          tone === "good" && { color: colors.leaf },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <Centered>
      <ActivityIndicator color={colors.leaf} />
      {label ? (
        <Body muted style={{ marginTop: 12 }}>
          {label}
        </Body>
      ) : null}
    </Centered>
  );
}

/* ---------- Controls ---------- */

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  busy = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "dark" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "dark" && styles.buttonDark,
        variant === "ghost" && styles.buttonGhost,
        // The web app scales buttons slightly on press; this is the
        // equivalent gesture feedback.
        pressed && !inactive && styles.buttonPressed,
        inactive && styles.buttonInactive,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={variant === "ghost" ? colors.inkFaint : "#fff"}
        />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          variant === "ghost" && styles.buttonTextGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Minus / number / plus, matching the web cart's stepper.
 *
 * Reports a *delta* rather than an absolute value on purpose. The quantity
 * prop is whatever the last render saw, so computing `quantity - 1` here
 * would lose the second of two taps that land before React re-renders. The
 * owner resolves the delta against the current state instead.
 */
export function QuantityStepper({
  quantity,
  onAdjust,
  max = 99,
  accessibilityLabel,
}: {
  quantity: number;
  onAdjust: (delta: number) => void;
  max?: number;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.stepper} accessibilityLabel={accessibilityLabel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        onPress={() => onAdjust(-1)}
        style={styles.stepperButton}
      >
        <Text style={styles.stepperGlyph}>&#8722;</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{quantity}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        onPress={() => onAdjust(1)}
        disabled={quantity >= max}
        style={styles.stepperButton}
      >
        <Text
          style={[styles.stepperGlyph, quantity >= max && { opacity: 0.35 }]}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: fontSerif,
    fontSize: 28,
    lineHeight: 34,
    color: colors.ink,
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  bodyMuted: { color: colors.inkFaint, fontSize: 13, lineHeight: 19 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.inkFaint,
  },
  price: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 16,
  },

  banner: { borderRadius: radius.md, borderWidth: 1, padding: 12 },
  bannerInfo: { borderColor: colors.line, backgroundColor: colors.card },
  bannerWarn: { borderColor: "#e3c79e", backgroundColor: "#fdf7ef" },
  bannerGood: { borderColor: "#b9d3c6", backgroundColor: "#f1f7f4" },
  bannerText: { fontSize: 13, lineHeight: 19, color: colors.inkSoft },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  buttonPrimary: { backgroundColor: colors.leaf },
  buttonDark: { backgroundColor: colors.ink },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  buttonInactive: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  buttonTextGhost: { color: colors.inkFaint, fontWeight: "500" },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  stepperButton: { paddingHorizontal: 14, paddingVertical: 7 },
  stepperGlyph: { fontSize: 17, color: colors.inkSoft },
  stepperValue: {
    minWidth: 26,
    textAlign: "center",
    fontSize: 15,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
});

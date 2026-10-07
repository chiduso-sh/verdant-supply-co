import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MAX_QUANTITY } from "@shop/cart";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import {
  Banner,
  Body,
  Button,
  Card,
  Centered,
  Heading,
  Label,
  Loading,
  Price,
  QuantityStepper,
} from "../components/ui";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Cart">;

export function CartScreen({ navigation }: Props) {
  const { status } = useAuth();
  const { lines, subtotalCents, loading, syncing, error, adjust, remove } =
    useCart();

  if (status !== "signedIn") {
    return (
      <Centered>
        <Heading>Your cart lives on your account</Heading>
        <Body muted style={styles.signInCopy}>
          Sign in and this cart is the same one you have on the website — add
          something on your laptop and it shows up here.
        </Body>
        <Button
          label="Sign in"
          onPress={() => navigation.navigate("SignIn")}
          style={{ marginTop: 22 }}
        />
      </Centered>
    );
  }

  if (loading && lines.length === 0) return <Loading label="Loading your cart" />;

  if (lines.length === 0) {
    return (
      <Centered>
        <Heading>Your cart is empty</Heading>
        <Body muted style={{ marginTop: 8 }}>
          Nothing picked out yet.
        </Body>
        <Button
          label="Browse the shop"
          variant="dark"
          onPress={() => navigation.navigate("Catalogue")}
          style={{ marginTop: 22 }}
        />
      </Centered>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={styles.page}
    >
      {error ? (
        <View style={{ marginBottom: 14 }}>
          <Banner tone="warn">{error}</Banner>
        </View>
      ) : null}

      {lines.map((line) => (
        <View key={line.productId} style={styles.row}>
          <Image
            source={{ uri: line.imageUrl }}
            style={styles.thumb}
            accessibilityIgnoresInvertColors
          />
          <View style={styles.rowBody}>
            <Body style={styles.name}>{line.name}</Body>
            <Body muted style={{ marginTop: 2 }}>
              {/* Per-unit price, so the line total below is explicable. */}
              <Price cents={line.priceCents} style={styles.each} /> each
            </Body>

            <View style={styles.rowControls}>
              <QuantityStepper
                quantity={line.quantity}
                max={MAX_QUANTITY}
                onAdjust={(delta) => adjust(line.productId, delta)}
                accessibilityLabel={`Quantity of ${line.name}`}
              />
              <Price cents={line.priceCents * line.quantity} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => remove(line.productId)}
              style={styles.removeHit}
            >
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Card style={{ marginTop: 10 }}>
        <Label>Subtotal</Label>
        <Price cents={subtotalCents} style={styles.subtotal} />
        <Body muted style={{ marginTop: 4 }}>
          {syncing
            ? "Saving…"
            : "Synced with your account. Prices are re-checked at checkout."}
        </Body>
        <Button
          label="Checkout"
          onPress={() => navigation.navigate("Checkout")}
          style={{ marginTop: 16 }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, backgroundColor: colors.paper },
  signInCopy: { marginTop: 10, textAlign: "center" },
  row: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  rowBody: { flex: 1 },
  name: { color: colors.ink, fontSize: 16 },
  each: { fontSize: 13, fontWeight: "400", color: colors.inkFaint },
  rowControls: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  removeHit: { marginTop: 8, alignSelf: "flex-start" },
  remove: {
    fontSize: 12,
    color: colors.inkFaint,
    textDecorationLine: "underline",
  },
  subtotal: { fontFamily: undefined, fontSize: 28, marginTop: 4 },
});

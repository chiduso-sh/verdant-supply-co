import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ApiError, fetchOrder, type OrderDetail } from "../api";
import { useAuth } from "../auth";
import {
  Banner,
  Body,
  Button,
  Card,
  Heading,
  Label,
  Loading,
  Price,
} from "../components/ui";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "OrderDetail">;

export function OrderDetailScreen({ route, navigation }: Props) {
  const { id, isNew } = route.params;
  const { token } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    (async () => {
      try {
        setOrder(await fetchOrder(token, id, controller.signal));
        setError(null);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Could not load that order.",
        );
      }
    })();

    return () => controller.abort();
  }, [token, id]);

  if (error) {
    return (
      <View style={styles.page}>
        <Banner tone="warn">{error}</Banner>
      </View>
    );
  }

  if (!order) return <Loading />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={styles.page}
    >
      {isNew ? (
        <View style={{ marginBottom: 16 }}>
          <Banner tone="good">
            Order confirmed. We have emailed a confirmation to {order.email}.
            Keep your order number handy: {order.orderNumber}
          </Banner>
        </View>
      ) : null}

      <Card>
        <View style={styles.headRow}>
          <Heading style={{ fontSize: 22 }}>{order.orderNumber}</Heading>
          <Body muted>{order.status}</Body>
        </View>
        <Body muted style={{ marginTop: 2 }}>
          Placed{" "}
          {new Date(order.createdAt).toLocaleString("en-US", {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </Body>

        <View style={styles.items}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Body style={{ color: colors.ink }}>{item.name}</Body>
                <Body muted style={{ marginTop: 2 }}>
                  Qty {item.quantity} × <Price cents={item.unitPriceCents} style={styles.unit} />
                </Body>
              </View>
              <Price cents={item.unitPriceCents * item.quantity} />
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Body>Total</Body>
          <Price cents={order.subtotalCents} style={{ fontSize: 18 }} />
        </View>

        <View style={{ marginTop: 22 }}>
          <Label>Shipping to</Label>
          {order.addressLines.map((line) => (
            <Body key={line} style={{ marginTop: 2 }}>
              {line}
            </Body>
          ))}
        </View>
      </Card>

      <Button
        label="All orders"
        variant="ghost"
        onPress={() => navigation.navigate("Orders")}
        style={{ marginTop: 18 }}
      />
      <Button
        label="Back to shop"
        variant="ghost"
        onPress={() => navigation.navigate("Catalogue")}
        style={{ marginTop: 10 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, backgroundColor: colors.paper },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  items: {
    marginTop: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
  },
  unit: { fontSize: 13, fontWeight: "400", color: colors.inkFaint },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
});

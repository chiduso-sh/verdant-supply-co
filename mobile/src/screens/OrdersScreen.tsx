import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ApiError, fetchOrders, type OrderSummary } from "../api";
import { useAuth } from "../auth";
import {
  Banner,
  Body,
  Button,
  Centered,
  Heading,
  Loading,
  Price,
} from "../components/ui";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Orders">;

export function OrdersScreen({ navigation }: Props) {
  const { token, status, user, signOut } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrders(await fetchOrders(token));
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Could not load orders.",
      );
    }
  }, [token]);

  // Re-read on focus: an order placed on the website while this screen sat in
  // the back stack should be here when it comes forward.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (status !== "signedIn") {
    return (
      <Centered>
        <Heading>Your orders</Heading>
        <Body muted style={{ marginTop: 8 }}>
          Sign in to see your order history.
        </Body>
        <Button
          label="Sign in"
          onPress={() => navigation.navigate("SignIn")}
          style={{ marginTop: 20 }}
        />
      </Centered>
    );
  }

  if (!orders && !error) return <Loading />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.leaf}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Heading>Your orders</Heading>
      <Body muted style={{ marginTop: 6 }}>
        Signed in as {user?.email ?? "your account"}
      </Body>

      {error ? (
        <View style={{ marginTop: 14 }}>
          <Banner tone="warn">{error}</Banner>
        </View>
      ) : null}

      {orders && orders.length === 0 ? (
        <View style={{ marginTop: 18 }}>
          <Banner>No orders yet. Go buy a plant.</Banner>
        </View>
      ) : null}

      {(orders ?? []).map((order) => (
        <Pressable
          key={order.id}
          accessibilityRole="button"
          accessibilityLabel={`Order ${order.orderNumber}`}
          onPress={() => navigation.navigate("OrderDetail", { id: order.id })}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1 }}>
            <Body style={styles.number}>{order.orderNumber}</Body>
            <Body muted style={{ marginTop: 2 }}>
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              · {order.status}
            </Body>
          </View>
          <Price cents={order.subtotalCents} />
        </Pressable>
      ))}

      <Button
        label="Sign out"
        variant="ghost"
        onPress={signOut}
        style={{ marginTop: 28 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, backgroundColor: colors.paper },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 10,
  },
  number: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});

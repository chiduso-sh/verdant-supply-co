import { NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth";
import { CartProvider, useCart } from "./src/cart";
import { fontSerif } from "./src/components/ui";
import type { RootStackParamList } from "./src/navigation";
import { CartScreen } from "./src/screens/CartScreen";
import { CatalogueScreen } from "./src/screens/CatalogueScreen";
import { CheckoutScreen } from "./src/screens/CheckoutScreen";
import { OrderDetailScreen } from "./src/screens/OrderDetailScreen";
import { OrdersScreen } from "./src/screens/OrdersScreen";
import { ProductScreen } from "./src/screens/ProductScreen";
import { SignInScreen } from "./src/screens/SignInScreen";
import { colors, radius } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

/** React Navigation's theme, pointed at the shop's palette. */
const theme: Theme = {
  dark: false,
  colors: {
    primary: colors.leaf,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
    notification: colors.ochre,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "600" },
    heavy: { fontFamily: "System", fontWeight: "700" },
  },
};

/**
 * The header's cart button, with the live count.
 *
 * It reads the same cart context every screen does, so a change pushed from
 * the website shows up here within a poll interval without any screen having
 * to ask for it.
 */
function CartButton({ onPress }: { onPress: () => void }) {
  const { count, syncing } = useCart();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"
      }
      onPress={onPress}
      style={({ pressed }) => [styles.cartButton, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.cartLabel}>Cart</Text>
      {count > 0 ? (
        <View style={[styles.badge, syncing && { opacity: 0.6 }]}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function AccountButton({ onPress }: { onPress: () => void }) {
  const { status } = useAuth();

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>
        {status === "signedIn" ? "Orders" : "Sign in"}
      </Text>
    </Pressable>
  );
}

function Shop() {
  const { status } = useAuth();

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerTitleStyle: { fontFamily: fontSerif, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen
          name="Catalogue"
          component={CatalogueScreen}
          options={({ navigation }) => ({
            title: "Shop",
            headerLeft: () => (
              <AccountButton
                onPress={() =>
                  navigation.navigate(
                    status === "signedIn" ? "Orders" : "SignIn",
                  )
                }
              />
            ),
            headerRight: () => (
              <CartButton onPress={() => navigation.navigate("Cart")} />
            ),
          })}
        />
        <Stack.Screen
          name="Product"
          component={ProductScreen}
          options={({ route, navigation }) => ({
            title: route.params.name,
            headerRight: () => (
              <CartButton onPress={() => navigation.navigate("Cart")} />
            ),
          })}
        />
        <Stack.Screen name="Cart" component={CartScreen} options={{ title: "Cart" }} />
        <Stack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{ title: "Checkout" }}
        />
        <Stack.Screen
          name="Orders"
          component={OrdersScreen}
          options={{ title: "Orders" }}
        />
        <Stack.Screen
          name="OrderDetail"
          component={OrderDetailScreen}
          options={{ title: "Order" }}
        />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ title: "Sign in" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Auth wraps Cart: the cart is per-account, so it needs the token
          before it can load anything. */}
      <AuthProvider>
        <CartProvider>
          <Shop />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  cartButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  cartLabel: { fontSize: 14, color: colors.ink, fontWeight: "500" },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.leaf,
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  link: { paddingVertical: 6, paddingRight: 12 },
  linkText: { fontSize: 14, color: colors.inkFaint },
});

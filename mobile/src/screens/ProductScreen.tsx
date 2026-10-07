import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { MAX_QUANTITY } from "@shop/cart";
import { ApiError, fetchProduct, type ApiProduct } from "../api";
import { useCart } from "../cart";
import {
  Banner,
  Body,
  Button,
  Heading,
  Label,
  Loading,
  Price,
  QuantityStepper,
} from "../components/ui";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Product">;

export function ProductScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const { add } = useCart();

  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setProduct(await fetchProduct(slug, controller.signal));
        setError(null);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Could not load that product.",
        );
      }
    })();

    return () => controller.abort();
  }, [slug]);

  if (error) {
    return (
      <View style={styles.page}>
        <Banner tone="warn">{error}</Banner>
      </View>
    );
  }

  if (!product) return <Loading />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={styles.page}
    >
      <Image
        source={{ uri: product.imageUrl }}
        style={styles.hero}
        accessibilityIgnoresInvertColors
      />

      <Label>{product.category}</Label>
      <Heading style={{ marginTop: 6 }}>{product.name}</Heading>
      <Price cents={product.priceCents} style={styles.price} />

      <Body style={{ marginTop: 14 }}>{product.description}</Body>

      <View style={styles.actions}>
        <QuantityStepper
          quantity={quantity}
          max={MAX_QUANTITY}
          onAdjust={(delta) =>
            setQuantity((current) =>
              Math.min(Math.max(1, current + delta), MAX_QUANTITY),
            )
          }
          accessibilityLabel="Quantity"
        />
        <Button
          label="Add to cart"
          onPress={() => {
            add(
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                imageUrl: product.imageUrl,
              },
              quantity,
            );
            navigation.navigate("Cart");
          }}
          style={{ flexGrow: 1 }}
        />
      </View>

      <Body muted style={{ marginTop: 18 }}>
        Prices are re-checked against the database at checkout.
      </Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, backgroundColor: colors.paper },
  hero: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    marginBottom: 18,
  },
  price: { fontSize: 20, marginTop: 8 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
});

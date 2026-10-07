import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ApiError, fetchProducts, type ApiProduct } from "../api";
import { useCart } from "../cart";
import {
  Banner,
  Body,
  Button,
  Heading,
  Label,
  Loading,
  Price,
} from "../components/ui";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Catalogue">;

/** The shop front: the whole catalogue, grouped by category. */
export function CatalogueScreen({ navigation }: Props) {
  const [products, setProducts] = useState<ApiProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setProducts(await fetchProducts(signal));
      setError(null);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not load the catalogue.",
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!products && !error) return <Loading label={"Loading the shop…"} />;

  return (
    <FlatList
      data={products ?? []}
      keyExtractor={(product) => String(product.id)}
      contentContainerStyle={styles.list}
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
      ListHeaderComponent={
        <View style={styles.header}>
          <Heading>Verdant Supply Co.</Heading>
          <Body muted style={{ marginTop: 6 }}>
            Houseplants, hand-thrown vessels, and the tools to keep them alive.
          </Body>
          {error ? (
            <View style={{ marginTop: 14 }}>
              <Banner tone="warn">{error}</Banner>
            </View>
          ) : null}
        </View>
      }
      // A category heading is rendered whenever the category changes, which
      // keeps the grouping without a SectionList's extra ceremony.
      renderItem={({ item, index }) => {
        const previous = index > 0 ? (products ?? [])[index - 1] : null;
        const startsCategory = previous?.category !== item.category;

        return (
          <View>
            {startsCategory ? (
              <View style={styles.categoryRow}>
                <Label>{item.category}</Label>
              </View>
            ) : null}
            <ProductRow
              product={item}
              onOpen={() =>
                navigation.navigate("Product", {
                  slug: item.slug,
                  name: item.name,
                })
              }
            />
          </View>
        );
      }}
    />
  );
}

function ProductRow({
  product,
  onOpen,
}: {
  product: ApiProduct;
  onOpen: () => void;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  // Mirrors the web button's brief "Added" confirmation.
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(timer);
  }, [added]);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${product.name}`}
      >
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
      </Pressable>

      <View style={styles.rowBody}>
        <Pressable onPress={onOpen} accessibilityRole="button">
          <Body style={styles.name}>{product.name}</Body>
        </Pressable>
        <Price cents={product.priceCents} style={{ marginTop: 2 }} />
        <Button
          label={added ? "Added" : "Add to cart"}
          variant={added ? "primary" : "dark"}
          onPress={() => {
            add(
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                imageUrl: product.imageUrl,
              },
              1,
            );
            setAdded(true);
          }}
          style={styles.rowButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 48, backgroundColor: colors.paper },
  header: { marginBottom: 8 },
  categoryRow: { marginTop: 22, marginBottom: 8 },
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
    width: 78,
    height: 78,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  rowBody: { flex: 1, justifyContent: "center" },
  name: { color: colors.ink, fontSize: 16 },
  rowButton: { marginTop: 10, alignSelf: "flex-start", paddingVertical: 9 },
});

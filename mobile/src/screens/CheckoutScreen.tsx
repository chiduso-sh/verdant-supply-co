import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { citiesFor, COUNTRIES, regionsFor } from "@shop/geo";
import { ApiError, placeOrder, type ShippingBody } from "../api";
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
  Price,
} from "../components/ui";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

const EMPTY: ShippingBody = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
};

/**
 * Checkout.
 *
 * The country, region and city lists come from `@shop/geo` — the same module
 * the website's form uses — so the two cannot drift into offering different
 * places. Validation is the server's: `createOrder` runs `validateShipping`
 * and returns a message written to be shown, which is what the banner renders.
 */
export function CheckoutScreen({ navigation }: Props) {
  const { token, user, status } = useAuth();
  const { lines, subtotalCents, refresh } = useCart();

  const [shipping, setShipping] = useState<ShippingBody>({
    ...EMPTY,
    fullName: user?.name ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const regions = useMemo(() => regionsFor(shipping.country), [shipping.country]);
  const cities = useMemo(
    () => citiesFor(shipping.country, shipping.state),
    [shipping.country, shipping.state],
  );

  if (status !== "signedIn" || !token) {
    return (
      <Centered>
        <Heading>Sign in to check out</Heading>
        <Button
          label="Sign in"
          onPress={() => navigation.navigate("SignIn")}
          style={{ marginTop: 20 }}
        />
      </Centered>
    );
  }

  if (lines.length === 0) {
    return (
      <Centered>
        <Heading>Nothing to check out</Heading>
        <Body muted style={{ marginTop: 8 }}>
          Add something to your cart first.
        </Body>
      </Centered>
    );
  }

  const set = (field: keyof ShippingBody) => (value: string) =>
    setShipping((current) => ({ ...current, [field]: value }));

  // Changing a country invalidates the region and city chosen under the old
  // one, so they are cleared rather than left mismatched.
  const chooseCountry = (country: string) =>
    setShipping((current) => ({ ...current, country, state: "", city: "" }));
  const chooseRegion = (state: string) =>
    setShipping((current) => ({ ...current, state, city: "" }));

  async function submit() {
    setError(null);
    setPending(true);

    try {
      const result = await placeOrder(token!, shipping);
      // The server emptied the cart as part of placing the order; pick that up
      // so the badge is right before the screen changes.
      refresh();
      navigation.replace("OrderDetail", { id: result.order.id, isNew: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not place that order. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ backgroundColor: colors.paper }}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <Heading>Checkout</Heading>
        <Body muted style={{ marginTop: 6 }}>
          Confirmation will be emailed to {user?.email ?? "your account"}.
        </Body>

        <Card style={{ marginTop: 18 }}>
          <Label>Order summary</Label>
          {lines.map((line) => (
            <View key={line.productId} style={styles.summaryRow}>
              <Body style={{ flex: 1 }}>
                {line.name}
                <Text style={styles.qty}> × {line.quantity}</Text>
              </Body>
              <Price cents={line.priceCents * line.quantity} />
            </View>
          ))}
          <View style={styles.totalRow}>
            <Body>Total</Body>
            <Price cents={subtotalCents} style={{ fontSize: 18 }} />
          </View>
        </Card>

        <Card style={{ marginTop: 14 }}>
          <Label>Shipping address</Label>

          <Field
            label="Full name"
            required
            value={shipping.fullName}
            onChange={set("fullName")}
            autoComplete="name"
          />
          <Field
            label="Address"
            required
            value={shipping.line1}
            onChange={set("line1")}
            autoComplete="street-address"
          />
          <Field
            label="Apartment, suite (optional)"
            value={shipping.line2}
            onChange={set("line2")}
          />

          <Picker
            label="Country"
            required
            value={shipping.country}
            placeholder="Select a country"
            options={COUNTRIES.map((country) => country.name)}
            onChange={chooseCountry}
          />

          {regions.length > 0 ? (
            <Picker
              label="State / region"
              required
              value={shipping.state}
              placeholder="Select a state"
              options={regions}
              onChange={chooseRegion}
            />
          ) : (
            <Field
              label="State / region"
              required
              value={shipping.state}
              onChange={set("state")}
            />
          )}

          {cities.length > 0 ? (
            <Picker
              label="City"
              required
              value={shipping.city}
              placeholder="Select a city"
              options={cities}
              onChange={set("city")}
            />
          ) : (
            <Field
              label="City"
              required
              value={shipping.city}
              onChange={set("city")}
            />
          )}

          <Field
            label="Postal code"
            required
            value={shipping.postalCode}
            onChange={set("postalCode")}
            autoComplete="postal-code"
          />
          <Field
            label="Phone (optional)"
            value={shipping.phone}
            onChange={set("phone")}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        </Card>

        <View style={{ marginTop: 14 }}>
          <Banner>
            No payment step: this is a demo build, so no card details are
            collected and nothing is charged.
          </Banner>
        </View>

        {error ? (
          <View style={{ marginTop: 14 }}>
            <Banner tone="warn">{error}</Banner>
          </View>
        ) : null}

        <Button
          label={pending ? "Placing order…" : "Place order"}
          onPress={submit}
          busy={pending}
          style={{ marginTop: 18 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  keyboardType,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  keyboardType?: "default" | "phone-pad";
  autoComplete?: "name" | "street-address" | "postal-code" | "tel";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.ochre }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? "default"}
        autoComplete={autoComplete}
        style={styles.input}
        placeholderTextColor={colors.inkFaint}
      />
    </View>
  );
}

/**
 * A select, as a tap-to-open modal list.
 *
 * React Native has no cross-platform `<select>`, and the country list is ~240
 * entries, so a scrollable sheet is both the platform-idiomatic answer and
 * the only usable one at that length.
 */
function Picker({
  label,
  value,
  placeholder,
  options,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.ochre }}> *</Text> : null}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        onPress={() => setOpen(true)}
        style={styles.input}
      >
        <Text style={value ? styles.pickerValue : styles.pickerPlaceholder}>
          {value || placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            {options.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={styles.option}
              >
                <Text
                  style={[
                    styles.optionText,
                    option === value && { color: colors.leaf, fontWeight: "600" },
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 56, backgroundColor: colors.paper },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  qty: { color: colors.inkFaint, fontSize: 13 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 12,
    paddingTop: 12,
  },

  field: { marginTop: 14 },
  fieldLabel: { fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    justifyContent: "center",
    minHeight: 44,
  },
  pickerValue: { fontSize: 15, color: colors.ink },
  pickerPlaceholder: { fontSize: 15, color: colors.inkFaint },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(28,27,25,0.35)" },
  modalSheet: {
    maxHeight: "70%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  modalClose: { fontSize: 15, color: colors.leaf },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  optionText: { fontSize: 15, color: colors.inkSoft },
});

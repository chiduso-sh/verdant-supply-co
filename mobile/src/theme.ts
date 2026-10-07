/**
 * The palette, transcribed from the web app's `@theme` block in
 * app/globals.css.
 *
 * Duplicated rather than shared because Tailwind's tokens are CSS custom
 * properties and there is no runtime to read them from here. Twelve hex
 * values is a cheap thing to keep in step; a build step to extract them would
 * not be.
 */
export const colors = {
  paper: "#f7f6f3",
  card: "#ffffff",
  ink: "#1c1b19",
  inkSoft: "#4a4842",
  inkFaint: "#8a8780",
  line: "#e8e6e1",
  leaf: "#2f5d4a",
  leafDark: "#244839",
  leafLight: "#4a8268",
  ochre: "#b4762b",
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** The serif the shop front uses for headings, per platform. */
export const serif = {
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
} as const;

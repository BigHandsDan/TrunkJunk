// Design tokens — must match the design-foundations spec.
export const Colors = {
  bg: "#F7F6F2",
  surface: "#F9F8F5",
  surfaceAlt: "#FBFBF9",
  border: "#D4D1CA",
  text: "#28251D",
  muted: "#7A7974",
  faint: "#BAB9B4",
  primary: "#01696F",
  primaryHover: "#0C4E54",
  error: "#A12C7B",
  warning: "#964219",
  success: "#437A22",
  gold: "#D19900",
  terra: "#A84B2F",
};

export const Radii = { sm: 6, md: 10, lg: 16, pill: 999 };
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const Type = {
  hero: { fontSize: 32, fontWeight: "700" as const },
  title: { fontSize: 22, fontWeight: "700" as const },
  heading: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
};

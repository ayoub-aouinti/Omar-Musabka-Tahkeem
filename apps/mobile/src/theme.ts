/**
 * "Serene Justice" — the palette for the judges' app.
 * Values are lifted verbatim from the design brief; keep them in sync with the
 * dashboard so a judge and an admin see the same greens.
 */
export const colors = {
  primary: "#006b33",
  primaryContainer: "#008743",
  onPrimary: "#ffffff",
  onPrimaryContainer: "#f6fff3",
  secondary: "#5f5e5e",
  tertiary: "#595d59",
  tertiaryFixed: "#e0e3df",
  background: "#fbf9f8",
  surface: "#fbf9f8",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f5f3f3",
  surfaceContainer: "#efeded",
  surfaceContainerHigh: "#e9e8e7",
  onSurface: "#1b1c1c",
  onSurfaceVariant: "#3e4a3f",
  outline: "#6e7a6e",
  outlineVariant: "#bdcabc",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  primaryFixed: "#8afaa6",
  mushafPaper: "#FFFDF9",
  /** Soft grey wash marking the question span on the mushaf page. */
  mushafHighlight: "#e6e2da",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Judges tap fast; every interactive target must clear this. */
export const MIN_TOUCH = 48;

export const fonts = {
  /** The loaded Qaloun mushaf ttf. Used only for Quranic text. */
  mushaf: "UthmanicQaloun",
} as const;

export const font = {
  mushaf: fonts.mushaf,
} as const;

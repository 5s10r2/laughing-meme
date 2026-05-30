/**
 * Living Blueprint domain tokens.
 *
 * Categorical room-type → colour map, kept separate from presentational
 * primitives. Values reference the `.lp-theme` CSS custom properties so they
 * stay in sync with the theme. Consumed by FloorComposition, the ledger, the
 * mapping components, and the storybook.
 */
export const TYPE_COLORS: Record<string, string> = {
  single: "var(--t-single)",
  double: "var(--t-double)",
  deluxe: "var(--t-deluxe)",
  triple: "var(--t-triple)",
};

/** Fallback colour for an unknown category. */
export const TYPE_COLOR_FALLBACK = "var(--t-single)";

export const typeColor = (category: string): string =>
  TYPE_COLORS[category] ?? TYPE_COLOR_FALLBACK;

/** Capitalize a normalised category/label key (e.g. "single" → "Single"). */
export const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

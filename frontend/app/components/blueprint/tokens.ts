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

/** Distinct, legible palette for arbitrary categories (room / studio / pg_room / 1bhk…),
 *  since real categories rarely match the four named ones above. */
export const CATEGORY_PALETTE = [
  "var(--t-single)", // indigo
  "var(--t-double)", // green
  "var(--t-deluxe)", // amber
  "var(--t-triple)", // slate
  "#8A7CC0", // violet
  "#3F8E9B", // teal
  "#C77DA3", // mauve
  "#D98C5F", // terracotta
];

/**
 * Build a stable category → colour map. Assigns a DISTINCT colour per distinct
 * category by first-seen order, so two types on one floor never collide and a
 * given type reads as the same colour across every floor.
 */
export function buildCategoryColors(categories: string[]): Map<string, string> {
  const order = Array.from(new Set(categories));
  const map = new Map<string, string>();
  order.forEach((cat, i) => map.set(cat, CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]));
  return map;
}

/** Capitalize a normalised category/label key (e.g. "single" → "Single"). */
export const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

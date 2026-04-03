/**
 * Shared utilities for property onboarding components.
 * Extracted from individual components to avoid duplication.
 */

/** Maps backend category slugs to human-readable plural labels */
export function humanizeCategory(category: string): string {
  const map: Record<string, string> = {
    pg_room: "Rooms",
    room: "Rooms",
    rooms: "Rooms",
    studio: "Studios",
    studios: "Studios",
    flat: "Flats",
    flats: "Flats",
    rk: "RKs",
    hostel_dorm: "Dorm Beds",
    bed: "Beds",
    beds: "Beds",
    dorm: "Dorm Beds",
  };
  return map[category.toLowerCase()] || category;
}

/** Maps backend category slugs to human-readable singular labels */
export function humanizeCategorySingular(category: string): string {
  const map: Record<string, string> = {
    pg_room: "PG Room",
    room: "Room",
    studio: "Studio",
    flat: "Flat",
    rk: "RK",
    hostel_dorm: "Hostel Dorm",
    bed: "Bed",
    dorm: "Dorm",
  };
  return map[category.toLowerCase()] || category;
}

/** Maps backend sharing_type slugs to human-readable labels */
export function humanizeSharingType(sharingType: string): string {
  const map: Record<string, string> = {
    private: "Private",
    single: "Private",
    double: "Double Sharing",
    double_sharing: "Double Sharing",
    triple: "Triple Sharing",
    triple_sharing: "Triple Sharing",
    dormitory: "Dormitory",
    dorm: "Dormitory",
  };
  return map[sharingType.toLowerCase()] || sharingType;
}

/** Color palette for package assignment visualization */
export const PACKAGE_COLORS = [
  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
] as const;

/** Get the color class string for a package by its ID */
export function getPackageColor(
  packageId: string,
  allPackages: { id: string }[]
): string {
  const idx = allPackages.findIndex((p) => p.id === packageId);
  return PACKAGE_COLORS[((idx % PACKAGE_COLORS.length) + PACKAGE_COLORS.length) % PACKAGE_COLORS.length];
}

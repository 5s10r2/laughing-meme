import { typeColor, buildCategoryColors } from "../components/blueprint/tokens";

type Props = Record<string, unknown>;
type Adapter = (props: Props) => Props;

function asRecord(value: unknown): Props {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Props) : {};
}

function arrayFrom(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value as Props);
  return undefined;
}

function pick(source: Props, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function pickString(source: Props, keys: string[], fallback?: string): string | undefined {
  const value = pick(source, keys);
  return value === undefined ? fallback : String(value);
}

function pickNumber(source: Props, keys: string[], fallback = 0): number {
  const value = pick(source, keys);
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pickOptionalNumber(source: Props, keys: string[]): number | undefined {
  const value = pick(source, keys);
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function pickBoolean(source: Props, keys: string[], fallback = false): boolean {
  const value = pick(source, keys);
  if (value === undefined) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "no", "0", "none"].includes(normalized)) return false;
    if (["true", "yes", "1"].includes(normalized)) return true;
  }
  return Boolean(value);
}

function pickArray(source: Props, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const value = arrayFrom(source[key]);
    if (value) return value;
  }
  return undefined;
}

function adaptUnitBreakdown(value: unknown): Props[] | undefined {
  const items = arrayFrom(value);
  if (!items) return undefined;
  return items.map((raw) => {
    const item = asRecord(raw);
    return {
      category: pickString(item, ["category", "type"], "room"),
      label: pickString(item, ["label", "name"], "Rooms"),
      count: pickNumber(item, ["count", "value", "number"]),
    };
  });
}

function adaptFloor(raw: unknown, index: number): Props {
  if (typeof raw === "string") return { index, label: raw, active: true };
  const floor = asRecord(raw);
  return {
    index: pickNumber(floor, ["index", "floor_index"], index),
    label: pickString(floor, ["label", "name", "floor", "floor_label", "floorLabel"], `Floor ${index}`),
    active: floor.active === undefined ? true : Boolean(floor.active),
    unitCount: pickNumber(floor, ["unitCount", "unit_count", "rooms", "room_count", "count"], 0),
    nameRange: pickString(floor, ["nameRange", "name_range", "range"]),
    unitBreakdown: adaptUnitBreakdown(pick(floor, ["unitBreakdown", "unit_breakdown", "breakdown"])),
    unitTypes: adaptUnitBreakdown(pick(floor, ["unitTypes", "unit_types", "unit_breakdown", "breakdown"])),
    suggestedRange: arrayFrom(pick(floor, ["suggestedRange", "suggested_range"])),
  };
}

function adaptPackage(raw: unknown, index: number): Props {
  if (typeof raw === "string") return { id: String(index), name: raw, active: true };
  const pkg = asRecord(raw);
  return {
    id: pickString(pkg, ["id"], String(index)),
    name: pickString(pkg, ["name", "package_name", "packageName", "package"], `Package ${index + 1}`),
    category: pickString(pkg, ["category", "type", "unit_type"], ""),
    sharing_type: pickString(pkg, ["sharing_type", "sharingType"]),
    sharingType: pickString(pkg, ["sharingType", "sharing_type"]),
    furnishing: pickString(pkg, ["furnishing", "furnishing_type"]),
    amenities: arrayFrom(pkg.amenities) ?? (pkg.ac ? ["AC"] : []),
    food_included: pkg.food_included,
    food_optional: pkg.food_optional,
    food: pickString(pkg, ["food", "food_type"]),
    ac: pickBoolean(pkg, ["ac"]),
    estimatedRent: pickString(pkg, ["estimatedRent", "estimated_rent", "rent", "starting_rent", "price"]),
    starting_rent: pickNumber(pkg, ["starting_rent", "rent", "price"]),
    security_deposit: pick(pkg, ["security_deposit", "securityDeposit", "deposit"]),
    lock_in_period: pick(pkg, ["lock_in_period", "lockIn", "lock_in"]),
    notice_period: pick(pkg, ["notice_period", "notice"]),
    active: pkg.active === undefined ? true : Boolean(pkg.active),
    disabled: Boolean(pkg.disabled),
  };
}

function adaptAssignment(raw: unknown): Props {
  const assignment = asRecord(raw);
  return {
    packageName: pickString(assignment, ["packageName", "package_name", "package", "name"], "Package"),
    unitCount: pickNumber(assignment, ["unitCount", "unit_count", "count", "rooms"]),
    count: pickNumber(assignment, ["count", "unitCount", "unit_count", "rooms"]),
  };
}

function adaptMapping(raw: unknown): Props {
  const mapping = asRecord(raw);
  const assignments = pickArray(mapping, ["assignments", "assignment_list", "packages", "package_assignments"]);
  const packageName = pickString(mapping, ["packageName", "package_name", "package"]);
  const unitCount = pickNumber(mapping, ["unitCount", "unit_count", "count", "rooms", "room_count", "units"]);
  return {
    floorLabel: pickString(mapping, ["floorLabel", "floor_label", "floor", "label"], "Floor"),
    assignments: assignments?.map(adaptAssignment) ?? (packageName ? [{ packageName, unitCount, count: unitCount }] : undefined),
    unitCount,
    count: unitCount,
    packageName,
  };
}

function adaptFloorName(raw: unknown, index: number): Props {
  const floor = asRecord(raw);
  const names = pickArray(floor, ["names", "room_names", "units", "rooms"]) ?? [];
  const units = names.map((name) => {
    if (typeof name === "string" || typeof name === "number") return { name: String(name) };
    const item = asRecord(name);
    return {
      name: pickString(item, ["name", "label", "unit_name", "room_name", "id"], ""),
      category: pickString(item, ["category", "type", "unit_type"]),
    };
  });
  return {
    floor: pickString(floor, ["floor", "floor_label", "floorLabel", "label"], `Floor ${index}`),
    names: units.map((unit) => unit.name),
    units,
  };
}

const ADAPTERS: Record<string, Adapter> = {
  IntroSummaryCard: (props) => ({
    ...props,
    user_name: pickString(props, ["user_name", "userName", "owner_name", "ownerName"]),
    property_name: pickString(props, ["property_name", "propertyName", "name"]),
    property_type: pickString(props, ["property_type", "propertyType", "type"]),
    property_location: pickString(props, ["property_location", "location"]),
    gender_preference: pickString(props, ["gender_preference", "gender"]),
    fields: pickArray(props, ["fields"])?.map((field) => {
      const item = asRecord(field);
      return {
        label: pickString(item, ["label", "name"], "Field"),
        value: pickString(item, ["value", "text"], ""),
      };
    }),
  }),

  FloorBuilder: (props) => ({
    ...props,
    floors: (pickArray(props, ["floors", "items"]) ?? []).map(adaptFloor),
    highlightFloor: pickNumber(props, ["highlightFloor", "highlight_floor"], -1),
  }),

  FloorMilestoneReceipt: (props) => ({
    ...props,
    floorLabel: pickString(props, ["floorLabel", "floor_label", "floor", "label"], "Floor"),
    unitCount: pickNumber(props, ["unitCount", "unit_count", "rooms", "count"]),
    nameRange: pickString(props, ["nameRange", "name_range", "range"]),
    unitCategory: pickString(props, ["unitCategory", "unit_category", "category"]),
  }),

  NamingPreview: (props) => ({
    ...props,
    patternDescription: pickString(props, ["patternDescription", "pattern_description", "pattern"], ""),
    preview: (pickArray(props, ["preview", "floors", "names"]) ?? []).map(adaptFloorName),
  }),

  UnitCountInput: (props) => ({
    ...props,
    floorLabel: pickString(props, ["floorLabel", "floor_label", "floor", "label"]),
    unitTypes: adaptUnitBreakdown(pick(props, ["unitTypes", "unit_types", "unitTypeBreakdown", "unit_breakdown", "breakdown"])),
    floors: (pickArray(props, ["floors", "batch_floors", "batchFloors"]) ?? []).map(adaptFloor),
  }),

  PackageSuggestionCard: (props) => ({
    ...props,
    suggestions: (pickArray(props, ["suggestions", "packages"]) ?? []).map(adaptPackage),
    location: pickString(props, ["location", "property_location"]),
  }),

  PackageForm: (props) => {
    const prefill = asRecord(props.prefill ?? props.defaults);
    const merged = { ...props, ...prefill };
    return {
      ...props,
      name: pickString(props, ["name", "package_name", "packageName"]),
      prefill: {
        ac: pickBoolean(merged, ["ac"]),
        food: pickString(merged, ["food"], "none"),
        furnishing: pickString(merged, ["furnishing"], "semi_furnished"),
        rent: pickOptionalNumber(merged, ["rent", "starting_rent"]),
        sharingType: pickString(merged, ["sharingType", "sharing_type"], "private"),
        category: pickString(merged, ["category"]),
        securityDeposit: pickOptionalNumber(merged, ["securityDeposit", "security_deposit"]),
        lockInMonths: pickOptionalNumber(merged, ["lockInMonths", "lock_in_period", "lockIn"]),
        noticeDays: pickOptionalNumber(merged, ["noticeDays", "notice_period", "notice"]),
      },
    };
  },

  PackageReceipt: (props) => ({
    ...props,
    name: pickString(props, ["name", "package_name", "packageName"], "Package"),
    rent: pickNumber(props, ["rent", "starting_rent", "price"]),
    ac: pickBoolean(props, ["ac"]),
    food: pickString(props, ["food"]),
    furnishing: pickString(props, ["furnishing"]),
    security_deposit: pickOptionalNumber(props, ["security_deposit", "securityDeposit", "deposit"]),
    lock_in_period: pickOptionalNumber(props, ["lock_in_period", "lockIn"]),
    notice_period: pickOptionalNumber(props, ["notice_period", "notice"]),
  }),

  PackageList: (props) => ({
    ...props,
    packages: (pickArray(props, ["packages", "items"]) ?? []).map(adaptPackage),
  }),

  FloorMappingRow: (props) => ({
    ...props,
    floorLabel: pickString(props, ["floorLabel", "floor_label", "floor"], `Floor ${pickNumber(props, ["floorIndex", "floor_index"])}`),
    floorIndex: pickNumber(props, ["floorIndex", "floor_index"]),
    units: (pickArray(props, ["units"]) ?? []).map((unit, index) => {
      const item = asRecord(unit);
      return {
        id: pickString(item, ["id"], String(index)),
        name: pickString(item, ["name", "unit"], String(index + 1)),
        category: pickString(item, ["category", "type", "unit_type"]),
        sharingType: pickString(item, ["sharingType", "sharing_type"]),
        packageId: pickString(item, ["packageId", "package_id"]),
        packageName: pickString(item, ["packageName", "package_name"]),
      };
    }),
    packages: (pickArray(props, ["packages"]) ?? []).map((pkg, index) => {
      const item = asRecord(pkg);
      return {
        id: pickString(item, ["id"], String(index)),
        name: pickString(item, ["name", "package"], `Package ${index + 1}`),
        color: pickString(item, ["color"]),
      };
    }),
  }),

  BulkMappingPreview: (props) => {
    const operations = (pickArray(props, ["operations", "suggestions", "mappings", "assignments", "floors", "items"]) ?? []).map(adaptMapping);
    const totalUnits = pickNumber(props, ["totalUnits", "total_units", "total_rooms", "totalRooms", "room_count"], operations.reduce<number>((sum, op) => {
      const assignments = arrayFrom(op.assignments) ?? [];
      return sum + assignments.reduce<number>((count, assignment) => count + pickNumber(asRecord(assignment), ["unitCount", "count"]), 0);
    }, 0));
    const totalFloors = pickNumber(props, ["totalFloors", "total_floors", "floor_count"], operations.length);
    return {
      ...props,
      description: pickString(props, ["description", "title"], `Assign ${totalUnits} room${totalUnits !== 1 ? "s" : ""} across ${totalFloors} floor${totalFloors !== 1 ? "s" : ""}`),
      operations,
      totalUnits,
      totalFloors,
    };
  },

  VerificationSummary: (props) => {
    const property = asRecord(pick(props, ["property", "property_info", "property_details"]));
    const hasProperty = Object.keys(property).length > 0 || pick(props, ["property_name", "propertyName", "name"]);
    return {
      ...props,
      property: hasProperty
        ? {
            propertyName: pickString({ ...props, ...property }, ["propertyName", "property_name", "name"]),
            propertyType: pickString({ ...props, ...property }, ["propertyType", "property_type", "type"]),
            location: pickString({ ...props, ...property }, ["location", "property_location"]),
            ownerName: pickString({ ...props, ...property }, ["ownerName", "owner_name", "user_name", "userName"]),
            genderPreference: pickString({ ...props, ...property }, ["genderPreference", "gender_preference", "gender"]),
          }
        : undefined,
      floors: (pickArray(props, ["floors", "floor_list", "structure", "floor_summary"]) ?? []).map(adaptFloor),
      packages: (pickArray(props, ["packages", "package_list", "package_summary"]) ?? []).map(adaptPackage),
      mappings: (pickArray(props, ["mappings", "mapping_list", "room_mappings", "mapping_summary"]) ?? []).map(adaptMapping),
      pending: (pickArray(props, ["pending", "pending_items", "issues", "pending_issues"]) ?? []).map((item) => {
        const pending = asRecord(item);
        const severity = pickString(pending, ["severity", "level"], "warning");
        return {
          description: pickString(pending, ["description", "message", "text"], "Unknown issue"),
          severity: severity === "error" ? "error" : "warning",
        };
      }),
    };
  },

  PendingItemsList: (props) => ({
    ...props,
    items: (pickArray(props, ["items", "pending", "pending_items", "issues"]) ?? []).map((item, index) => {
      const pending = asRecord(item);
      return {
        id: pickString(pending, ["id"], String(index)),
        description: pickString(pending, ["description", "message", "text"], "Unknown issue"),
        stage: pickString(pending, ["stage"], "verification"),
        fixAction: pickString(pending, ["fixAction", "fix_action"]),
      };
    }),
  }),

  // ── Living Blueprint (v2) — backend sends colourless data; map category → palette ──
  MassingModel: (props) => ({
    ...props,
    // An emitted massing is a settled snapshot of the model at emit time.
    state: pickString(props, ["state"], "settled"),
  }),

  FloorLedger: (props) => {
    const floorsRaw = pickArray(props, ["floors"]) ?? [];
    // One colour map across ALL floors → a category reads the same colour everywhere,
    // and two categories on one floor never collide (the old single-fallback bug).
    const allCategories: string[] = [];
    for (const raw of floorsRaw) {
      for (const seg of arrayFrom(asRecord(raw).segments) ?? []) {
        const key = pickString(asRecord(seg), ["key", "category"], "room") as string;
        if (!allCategories.includes(key)) allCategories.push(key);
      }
    }
    const colorFor = buildCategoryColors(allCategories);
    return {
      ...props,
      floors: floorsRaw.map((raw) => {
        const floor = asRecord(raw);
        const segments = (arrayFrom(floor.segments) ?? []).map((rawSegment) => {
          const segment = asRecord(rawSegment);
          const key = pickString(segment, ["key", "category"], "room") as string;
          return {
            key,
            label: pickString(segment, ["label"], key) as string,
            count: pickNumber(segment, ["count"]),
            color: pickString(segment, ["color"]) ?? colorFor.get(key) ?? typeColor(key),
          };
        });
        return { ...floor, segments };
      }),
    };
  },

  CompletionCelebration: (props) => {
    const stats = asRecord(props.stats);
    return {
      ...props,
      stats: {
        propertyName: pickString({ ...props, ...stats }, ["propertyName", "property_name", "name"], "Your Property"),
        totalFloors: pickNumber({ ...props, ...stats }, ["totalFloors", "total_floors", "floors", "floor_count"]),
        totalRooms: pickNumber({ ...props, ...stats }, ["totalRooms", "total_rooms", "rooms", "room_count", "units"]),
        totalPackages: pickNumber({ ...props, ...stats }, ["totalPackages", "total_packages", "packages", "package_count"]),
        propertyType: pickString({ ...props, ...stats }, ["propertyType", "property_type"]),
        location: pickString({ ...props, ...stats }, ["location"]),
      },
    };
  },
};

export function adaptComponentProps(name: string, props: Props): Props {
  return ADAPTERS[name]?.(props) ?? props;
}

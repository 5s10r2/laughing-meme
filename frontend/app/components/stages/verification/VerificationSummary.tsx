"use client";

import { Building2, Package, ArrowRightLeft, AlertCircle } from "lucide-react";
import { cn } from "../../../lib/cn";

interface PropertySection {
  propertyName?: string;
  propertyType?: string;
  location?: string;
  ownerName?: string;
}

interface FloorSummary {
  label: string;
  unitCount: number;
  nameRange?: string;
}

interface PackageSummary {
  name: string;
  rent?: number;
  ac?: boolean;
  attributes?: string[];
}

interface MappingSummary {
  floorLabel: string;
  packageName: string;
  count: number;
}

interface PendingItem {
  description: string;
  severity: "error" | "warning";
}

interface VerificationSummaryProps {
  property?: PropertySection;
  floors?: FloorSummary[];
  packages?: PackageSummary[];
  mappings?: MappingSummary[];
  pending?: PendingItem[];
  onSendMessage?: (text: string) => void;
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3 h-3 text-amber-400/70" />
      <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
        {title}
      </span>
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-zinc-800/30 last:border-0">
      <span className="text-[10px] text-zinc-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-300">{value}</span>
        {onChange && (
          <button
            onClick={onChange}
            className="text-[11px] text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer"
          >
            change
          </button>
        )}
      </div>
    </div>
  );
}

export function VerificationSummary({
  property: rawProperty,
  floors: rawFloors,
  packages: rawPackages,
  mappings: rawMappings,
  pending: rawPending,
  onSendMessage,
  ...rest
}: VerificationSummaryProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude

  // Property section — Claude may pass flat keys or nested object
  const property: PropertySection | undefined = rawProperty
    || (rest.property_info as PropertySection)
    || (rest.property_details as PropertySection)
    || ((rest.property_name || rest.propertyName)
      ? {
          propertyName: (rest.property_name || rest.propertyName || rest.name) as string,
          propertyType: (rest.property_type || rest.propertyType || rest.type) as string,
          location: (rest.property_location || rest.location) as string,
          ownerName: (rest.owner_name || rest.ownerName || rest.user_name || rest.userName) as string,
        }
      : undefined);

  // Floors section
  const rawFloorList = rawFloors
    || (rest.floor_list as FloorSummary[])
    || (rest.structure as FloorSummary[])
    || (rest.floor_summary as FloorSummary[]);
  const floors: FloorSummary[] | undefined = Array.isArray(rawFloorList)
    ? (rawFloorList as unknown[]).map((raw: unknown) => {
        const f = raw as Record<string, unknown>;
        return {
          label: (f.label || f.floor_label || f.floorLabel || f.floor || f.name || "Floor") as string,
          unitCount: (f.unitCount || f.unit_count || f.rooms || f.count || 0) as number,
          nameRange: (f.nameRange || f.name_range || f.range) as string | undefined,
        };
      })
    : undefined;

  // Packages section
  const rawPkgList = rawPackages
    || (rest.package_list as PackageSummary[])
    || (rest.package_summary as PackageSummary[]);
  const packages: PackageSummary[] | undefined = Array.isArray(rawPkgList)
    ? (rawPkgList as unknown[]).map((raw: unknown) => {
        const p = raw as Record<string, unknown>;
        return {
          name: (p.name || p.package_name || p.packageName || "Package") as string,
          rent: (p.rent || p.starting_rent || p.price || p.startingRent) as number | undefined,
          ac: p.ac as boolean | undefined,
          attributes: (p.attributes || p.tags) as string[] | undefined,
        };
      })
    : undefined;

  // Mappings section
  const rawMapList = rawMappings
    || (rest.mapping_list as MappingSummary[])
    || (rest.room_mappings as MappingSummary[])
    || (rest.mapping_summary as MappingSummary[]);
  const mappings: MappingSummary[] | undefined = Array.isArray(rawMapList)
    ? (rawMapList as unknown[]).map((raw: unknown) => {
        const m = raw as Record<string, unknown>;
        return {
          floorLabel: (m.floorLabel || m.floor_label || m.floor || "Floor") as string,
          packageName: (m.packageName || m.package_name || m.package || "Package") as string,
          count: (m.count || m.unitCount || m.unit_count || m.rooms || 0) as number,
        };
      })
    : undefined;

  // Pending section
  const rawPendList = rawPending
    || (rest.pending_items as PendingItem[])
    || (rest.issues as PendingItem[])
    || (rest.pending_issues as PendingItem[]);
  const pending: PendingItem[] | undefined = Array.isArray(rawPendList)
    ? (rawPendList as unknown[]).map((raw: unknown) => {
        const item = raw as Record<string, unknown>;
        return {
          description: (item.description || item.message || item.text || "Unknown issue") as string,
          severity: ((item.severity || item.level || "warning") as "error" | "warning"),
        };
      })
    : undefined;
  return (
    <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl px-4 py-4 my-2 space-y-4">
      <p className="text-xs font-semibold text-zinc-200 mb-1">
        Verification Summary
      </p>

      {/* Property Section */}
      {property && (
        <div>
          <SectionHeader icon={Building2} title="Property" />
          <div className="px-2 space-y-0">
            {property.propertyName && (
              <FieldRow
                label="Name"
                value={property.propertyName}
                onChange={() => onSendMessage?.(`I want to change the property name, currently '${property.propertyName}'`)}
              />
            )}
            {property.propertyType && (
              <FieldRow
                label="Type"
                value={property.propertyType}
                onChange={() => onSendMessage?.(`I want to change the property type, currently '${property.propertyType}'`)}
              />
            )}
            {property.location && (
              <FieldRow
                label="Location"
                value={property.location}
                onChange={() => onSendMessage?.(`I want to change the location, currently '${property.location}'`)}
              />
            )}
            {property.ownerName && (
              <FieldRow
                label="Owner"
                value={property.ownerName}
                onChange={() => onSendMessage?.(`I want to change the owner name, currently '${property.ownerName}'`)}
              />
            )}
          </div>
        </div>
      )}

      {/* Structure Section */}
      {floors && floors.length > 0 && (
        <div>
          <SectionHeader icon={Building2} title="Structure" />
          <div className="space-y-0 px-2">
            {floors.map((floor, i) => (
              <FieldRow
                key={i}
                label={floor.label}
                value={`${floor.unitCount} room${floor.unitCount !== 1 ? "s" : ""}${floor.nameRange ? ` (${floor.nameRange})` : ""}`}
                onChange={() => onSendMessage?.(`I want to change ${floor.label}, it currently has ${floor.unitCount} rooms${floor.nameRange ? ` (${floor.nameRange})` : ""}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Packages Section */}
      {packages && packages.length > 0 && (
        <div>
          <SectionHeader icon={Package} title="Packages" />
          <div className="space-y-0 px-2">
            {packages.map((pkg, i) => {
              const rentStr = pkg.rent ? `₹${pkg.rent.toLocaleString("en-IN")}` : "";
              const attrs = pkg.attributes?.join(", ") || "";
              const valueStr = [rentStr, attrs].filter(Boolean).join(" · ");
              return (
                <FieldRow
                  key={i}
                  label={pkg.name}
                  value={valueStr || "—"}
                  onChange={() => onSendMessage?.(`I want to change the ${pkg.name} package${rentStr ? `, currently ${rentStr}` : ""}`)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Mapping Section */}
      {mappings && mappings.length > 0 && (
        <div>
          <SectionHeader icon={ArrowRightLeft} title="Mapping" />
          <div className="space-y-0 px-2">
            {mappings.map((m, i) => (
              <FieldRow
                key={i}
                label={m.floorLabel}
                value={`${m.count} room${m.count !== 1 ? "s" : ""} → ${m.packageName}`}
                onChange={() => onSendMessage?.(`I want to change the mapping for ${m.floorLabel}, currently ${m.count} rooms assigned to ${m.packageName}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending Issues */}
      {pending && pending.length > 0 && (
        <div>
          <SectionHeader icon={AlertCircle} title="Pending" />
          <div className="space-y-1 px-2">
            {pending.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 text-xs py-1 px-2 rounded",
                  item.severity === "error"
                    ? "bg-red-500/10 text-red-300"
                    : "bg-orange-500/10 text-orange-300"
                )}
              >
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{item.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-zinc-800">
        {pending && pending.length > 0 && (
          <p className="text-[10px] text-amber-400/70 mb-2">
            Resolve {pending.length} pending item{pending.length !== 1 ? "s" : ""} first
          </p>
        )}
        <button
          onClick={() => onSendMessage?.("Everything looks correct, confirm")}
          className={cn(
            "w-full px-3 py-2 rounded-lg text-xs font-medium",
            "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
            "hover:bg-emerald-500/25 active:scale-95 transition-all",
            pending && pending.length > 0 && "opacity-50 cursor-not-allowed"
          )}
          disabled={!!(pending && pending.length > 0)}
        >
          Confirm everything &amp; go live →
        </button>
      </div>
    </div>
  );
}

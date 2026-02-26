"use client";

import { Building2, Package, ArrowRightLeft, AlertCircle, Pencil } from "lucide-react";
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
  onEdit,
}: {
  icon: React.ElementType;
  title: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-amber-400/70" />
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
          {title}
        </span>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-0.5"
        >
          <Pencil className="w-2.5 h-2.5" />
          Edit
        </button>
      )}
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
          <SectionHeader
            icon={Building2}
            title="Property"
            onEdit={() => onSendMessage?.("I want to edit property details")}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-2">
            {property.propertyName && (
              <div>
                <span className="text-[10px] text-zinc-600">Name</span>
                <p className="text-xs text-zinc-300">{property.propertyName}</p>
              </div>
            )}
            {property.propertyType && (
              <div>
                <span className="text-[10px] text-zinc-600">Type</span>
                <p className="text-xs text-zinc-300 capitalize">
                  {property.propertyType}
                </p>
              </div>
            )}
            {property.location && (
              <div>
                <span className="text-[10px] text-zinc-600">Location</span>
                <p className="text-xs text-zinc-300">{property.location}</p>
              </div>
            )}
            {property.ownerName && (
              <div>
                <span className="text-[10px] text-zinc-600">Owner</span>
                <p className="text-xs text-zinc-300">{property.ownerName}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Structure Section */}
      {floors && floors.length > 0 && (
        <div>
          <SectionHeader
            icon={Building2}
            title="Structure"
            onEdit={() => onSendMessage?.("I want to edit the structure")}
          />
          <div className="space-y-1 px-2">
            {floors.map((floor, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-0.5"
              >
                <span className="text-zinc-400">{floor.label}</span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-zinc-300 font-mono">
                    {floor.unitCount} room{floor.unitCount !== 1 ? "s" : ""}
                  </span>
                  {floor.nameRange && (
                    <span className="text-zinc-600">({floor.nameRange})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Packages Section */}
      {packages && packages.length > 0 && (
        <div>
          <SectionHeader
            icon={Package}
            title="Packages"
            onEdit={() => onSendMessage?.("I want to edit packages")}
          />
          <div className="space-y-1 px-2">
            {packages.map((pkg, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-300 font-medium">{pkg.name}</span>
                  {pkg.attributes && pkg.attributes.length > 0 && (
                    <span className="text-[10px] text-zinc-600">
                      {pkg.attributes.join(", ")}
                    </span>
                  )}
                </div>
                {pkg.rent && (
                  <span className="text-zinc-400 font-mono text-[11px]">
                    Rs.{pkg.rent.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapping Section */}
      {mappings && mappings.length > 0 && (
        <div>
          <SectionHeader
            icon={ArrowRightLeft}
            title="Mapping"
            onEdit={() => onSendMessage?.("I want to edit the mapping")}
          />
          <div className="space-y-1 px-2">
            {mappings.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-0.5"
              >
                <span className="text-zinc-400">{m.floorLabel}</span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-zinc-300 font-mono">
                    {m.count} room{m.count !== 1 ? "s" : ""}
                  </span>
                  <span className="text-amber-300/70 font-medium">
                    {m.packageName}
                  </span>
                </div>
              </div>
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
      <div className="flex gap-2 pt-2 border-t border-zinc-800">
        <button
          onClick={() => onSendMessage?.("Everything looks correct, confirm")}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg text-xs font-medium",
            "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
            "hover:bg-emerald-500/25 active:scale-95 transition-all",
            pending && pending.length > 0 && "opacity-50 cursor-not-allowed"
          )}
          disabled={!!(pending && pending.length > 0)}
        >
          Confirm Everything
        </button>
        <button
          onClick={() => onSendMessage?.("I need to fix some things")}
          className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 active:scale-95 transition-all"
        >
          Fix Issues
        </button>
      </div>
    </div>
  );
}

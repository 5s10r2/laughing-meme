"use client";

import { MappingRow, type MappingPackage, type MappingUnit } from "./MappingRow";

export interface BlueprintMappingFloor {
  floorId: string | number;
  floorLabel: string;
  units: MappingUnit[];
}

interface BlueprintMappingProps {
  packages?: MappingPackage[];
  floors?: BlueprintMappingFloor[];
  /** singular noun for the unit (room / flat / bed / unit); backend-projected */
  unitNoun?: string;
  /** true when the backend is the recursive Space tree → rows emit MapOffering, not MapRooms */
  treeMode?: boolean;
  onSendMessage?: (text: string) => void;
  /** Direct-edit mode (Blueprint panel) — forwarded to each row. */
  onApplyCommands?: (commands: Record<string, unknown>[], summary?: string) => void;
}

/**
 * Mapping stage view — fans the backend's `mapping_props` ({packages, floors}) into
 * one {@link MappingRow} per floor. Each row shares the same package palette so a
 * package reads as the same colour across floors.
 */
export function BlueprintMapping({
  packages = [],
  floors = [],
  unitNoun = "room",
  treeMode = false,
  onSendMessage,
  onApplyCommands,
}: BlueprintMappingProps) {
  if (floors.length === 0) return null;
  return (
    <div className="lp-theme space-y-3">
      {floors.map((floor) => (
        // data-floor-id: a scroll/flash anchor for the massing-model floor tap.
        <div key={floor.floorId} data-floor-id={String(floor.floorId)}>
          <MappingRow
            floorLabel={floor.floorLabel}
            units={floor.units}
            packages={packages}
            unitNoun={unitNoun}
            treeMode={treeMode}
            onSendMessage={onSendMessage}
            onApplyCommands={onApplyCommands}
          />
        </div>
      ))}
    </div>
  );
}

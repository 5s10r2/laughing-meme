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
  onSendMessage?: (text: string) => void;
}

/**
 * Mapping stage view — fans the backend's `mapping_props` ({packages, floors}) into
 * one {@link MappingRow} per floor. Each row shares the same package palette so a
 * package reads as the same colour across floors.
 */
export function BlueprintMapping({
  packages = [],
  floors = [],
  onSendMessage,
}: BlueprintMappingProps) {
  if (floors.length === 0) return null;
  return (
    <div className="lp-theme space-y-3">
      {floors.map((floor) => (
        <MappingRow
          key={floor.floorId}
          floorLabel={floor.floorLabel}
          units={floor.units}
          packages={packages}
          onSendMessage={onSendMessage}
        />
      ))}
    </div>
  );
}

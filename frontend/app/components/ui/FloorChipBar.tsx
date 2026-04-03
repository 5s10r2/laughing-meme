"use client";

import { useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";

interface FloorChip {
  index: number;
  label: string;
  status?: "done" | "pending" | "active";
}

interface FloorChipBarProps {
  floors: FloorChip[];
  selected: number;
  onSelect: (index: number) => void;
}

export function FloorChipBar({ floors, selected, onSelect }: FloorChipBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Auto-scroll to keep selected chip visible
  useEffect(() => {
    const chip = chipRefs.current.get(selected);
    if (chip && scrollRef.current) {
      const container = scrollRef.current;
      const chipLeft = chip.offsetLeft;
      const chipWidth = chip.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollLeft = container.scrollLeft;

      // If chip is out of view, scroll to center it
      if (chipLeft < scrollLeft || chipLeft + chipWidth > scrollLeft + containerWidth) {
        container.scrollTo({
          left: chipLeft - containerWidth / 2 + chipWidth / 2,
          behavior: "smooth",
        });
      }
    }
  }, [selected]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-0.5 px-0.5"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {floors.map((floor) => {
        const isSelected = floor.index === selected;
        const status = floor.status || (isSelected ? "active" : "pending");

        return (
          <button
            key={floor.index}
            ref={(el) => {
              if (el) chipRefs.current.set(floor.index, el);
            }}
            onClick={() => onSelect(floor.index)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
              "border transition-all duration-150 flex-shrink-0",
              "active:scale-95",
              isSelected && "bg-amber-500/20 text-amber-300 border-amber-500/40",
              !isSelected && status === "done" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
              !isSelected && status === "pending" && "bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-500",
              !isSelected && status === "active" && "bg-zinc-800/50 text-zinc-300 border-zinc-600"
            )}
          >
            {status === "done" && !isSelected && (
              <Check className="w-2.5 h-2.5" />
            )}
            {floor.label}
          </button>
        );
      })}
    </div>
  );
}

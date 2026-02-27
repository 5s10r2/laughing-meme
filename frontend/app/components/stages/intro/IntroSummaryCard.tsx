"use client";

import { MapPin, Building2, User, Tag } from "lucide-react";

interface IntroSummaryCardProps {
  user_name?: string;
  property_name?: string;
  property_type?: string;
  property_location?: string;
  onSendMessage?: (text: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  pg: "PG / Paying Guest",
  hostel: "Hostel",
  flat: "Flat / Apartment",
  studio: "Studio",
  rk: "RK",
  coliving: "Co-Living",
  mixed: "Mixed",
};

export function IntroSummaryCard({
  user_name,
  property_name,
  property_type,
  property_location,
  onSendMessage,
}: IntroSummaryCardProps) {
  const fields = [
    { icon: User, label: "Operator", value: user_name },
    { icon: Tag, label: "Property", value: property_name },
    { icon: Building2, label: "Type", value: property_type ? (TYPE_LABELS[property_type] || property_type) : undefined },
    { icon: MapPin, label: "Location", value: property_location },
  ].filter((f) => f.value);

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-xl px-4 py-3 my-2">
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2.5">
        Property Overview
      </p>
      <div className="space-y-0">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
            <div className="flex items-center gap-2">
              <field.icon className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
              <span className="text-xs text-zinc-500">{field.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-200">{field.value}</span>
              <button
                onClick={() => onSendMessage?.(`I want to change the ${field.label.toLowerCase()}, currently '${field.value}'`)}
                className="text-[11px] text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer"
              >
                change
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-zinc-800">
        <button
          onClick={() => onSendMessage?.("Looks good, let's continue to structure")}
          className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 active:scale-[0.98] transition-all"
        >
          Confirm &amp; continue →
        </button>
      </div>
    </div>
  );
}

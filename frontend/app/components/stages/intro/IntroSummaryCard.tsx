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
  ...rest
}: IntroSummaryCardProps & Record<string, unknown>) {
  // Claude may send { fields: [{label, value}] } or individual props — handle both
  const rawFields = rest.fields as Array<{ label: string; value: string }> | undefined;

  const ICON_MAP: Record<string, typeof User> = {
    owner: User, operator: User, name: User,
    property: Tag, "property name": Tag,
    type: Building2, "property type": Building2,
    location: MapPin, "property location": MapPin,
  };

  const fields = rawFields
    ? rawFields
        .filter((f) => f.value)
        .map((f) => ({
          icon: ICON_MAP[f.label.toLowerCase()] || Tag,
          label: f.label,
          value: f.label.toLowerCase().includes("type") ? (TYPE_LABELS[f.value] || f.value) : f.value,
        }))
    : [
        { icon: User, label: "Operator", value: user_name },
        { icon: Tag, label: "Property", value: property_name },
        { icon: Building2, label: "Type", value: property_type ? (TYPE_LABELS[property_type] || property_type) : undefined },
        { icon: MapPin, label: "Location", value: property_location },
      ].filter((f) => f.value);

  return (
    <div className="border border-border bg-bg-surface rounded-[var(--radius-card)] px-4 py-3 my-2">
      <p className="text-xs text-content-tertiary font-medium uppercase tracking-wider mb-2.5">
        Property Overview
      </p>
      <div className="space-y-0">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              <field.icon className="w-3.5 h-3.5 text-content-tertiary flex-shrink-0" />
              <span className="text-xs text-content-secondary">{field.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-content">{field.value}</span>
              <button
                onClick={() => onSendMessage?.(`I want to change the ${field.label.toLowerCase()}, currently '${field.value}'`)}
                className="text-xs text-content-tertiary hover:text-accent-lighter underline-offset-2 hover:underline transition-colors cursor-pointer px-2 py-1.5 -mr-2 -my-1.5 rounded"
              >
                change
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-border">
        <button
          onClick={() => onSendMessage?.("Looks good, let's continue to structure")}
          className="w-full px-3 py-2.5 rounded-[var(--radius-button)] text-[13px] font-semibold bg-accent/20 text-accent-lighter border border-accent/25 hover:bg-accent/25 active:scale-[0.98] transition-all"
        >
          Confirm &amp; continue →
        </button>
      </div>
    </div>
  );
}

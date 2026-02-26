"use client";

import { Check } from "lucide-react";

interface ConfirmationField {
  label: string;
  value: string;
}

interface DataConfirmationCardProps {
  title: string;
  fields: ConfirmationField[];
  stateVersion?: number;
}

export function DataConfirmationCard({ title, fields: rawFields }: DataConfirmationCardProps) {
  // Defensive: handle dict format {key: value} from backend or missing fields
  const fields: ConfirmationField[] = Array.isArray(rawFields)
    ? rawFields
    : rawFields && typeof rawFields === "object"
      ? Object.entries(rawFields).map(([label, value]) => ({ label, value: String(value) }))
      : [];
  return (
    <div className="border-l-2 border-emerald-500/40 bg-emerald-950/10 rounded-r-lg px-3.5 py-2.5 my-1.5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Check className="w-2.5 h-2.5 text-emerald-400" />
        </div>
        <span className="text-xs font-semibold text-emerald-300/90">{title}</span>
      </div>
      <div className="space-y-0.5 pl-6">
        {fields.map((field) => (
          <div key={field.label} className="flex items-baseline gap-1.5 text-xs">
            <span className="text-zinc-500">{field.label}:</span>
            <span className="text-zinc-300">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

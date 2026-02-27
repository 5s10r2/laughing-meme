"use client";

import { Check } from "lucide-react";

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ConfirmationField {
  label: string;
  value: string;
}

interface DataConfirmationCardProps {
  title: string;
  fields: ConfirmationField[];
  stateVersion?: number;
  onSendMessage?: (text: string) => void;
}

export function DataConfirmationCard({ title, fields: rawFields, onSendMessage }: DataConfirmationCardProps) {
  // Defensive: handle dict format {key: value} from backend or missing fields
  // Normalize labels from snake_case to Title Case
  const fields: ConfirmationField[] = Array.isArray(rawFields)
    ? rawFields.map((f) => ({ label: formatFieldLabel(f.label), value: f.value }))
    : rawFields && typeof rawFields === "object"
      ? Object.entries(rawFields).map(([label, value]) => ({
          label: formatFieldLabel(label),
          value: Array.isArray(value) ? `${value.length} items` : String(value),
        }))
      : [];
  return (
    <div className="border-l-2 border-emerald-500/40 bg-emerald-950/10 rounded-r-lg px-3.5 py-2.5 my-1.5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Check className="w-2.5 h-2.5 text-emerald-400" />
        </div>
        <span className="text-xs font-semibold text-emerald-300/90">{title}</span>
      </div>
      <div className="space-y-0 pl-6">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center justify-between py-0.5 border-b border-zinc-800/20 last:border-0">
            <div className="flex items-baseline gap-1.5 text-xs">
              <span className="text-zinc-500">{field.label}:</span>
              <span className="text-zinc-300">{field.value}</span>
            </div>
            {onSendMessage && (
              <button
                onClick={() => onSendMessage(`I want to change ${field.label.toLowerCase()}, currently '${field.value}'`)}
                className="text-[11px] text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer ml-2"
              >
                change
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

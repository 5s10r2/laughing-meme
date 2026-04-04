"use client";

import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  ICON_SM, EditButton,
} from "./primitives";

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
    <div className="bg-success/5 border border-success/15 rounded-2xl p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn(ICON_SM, "bg-success/12")}>
          <Check className="w-3.5 h-3.5 text-success" />
        </div>
        <p className="text-sm font-medium text-success">{title}</p>
      </div>
      <div className="pl-8 space-y-2">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center justify-between">
            <span className="text-xs text-content-tertiary">{field.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-content font-medium">{field.value}</span>
              {onSendMessage && (
                <EditButton
                  onClick={() => onSendMessage(`I want to change ${field.label.toLowerCase()}, currently '${field.value}'`)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

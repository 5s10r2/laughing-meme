"use client";

import { MapPin, Building2, User, Tag, Users, ArrowRight } from "lucide-react";
import {
  CARD, CARD_DIVIDER, ICON_CIRCLE, BTN_PRIMARY, EditButton,
} from "../../ui/primitives";
import { cn } from "../../../lib/cn";

interface IntroSummaryCardProps {
  user_name?: string;
  property_name?: string;
  property_type?: string;
  property_location?: string;
  gender_preference?: string;
  fields?: Array<{ label: string; value: string }>;
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

const GENDER_LABELS: Record<string, string> = {
  male: "Men",
  female: "Women",
  coed: "Co-ed",
};

export function IntroSummaryCard({
  user_name,
  property_name,
  property_type,
  property_location,
  gender_preference,
  fields: rawFields,
  onSendMessage,
}: IntroSummaryCardProps) {
  const gender = gender_preference || "";

  const ICON_MAP: Record<string, typeof User> = {
    owner: User, operator: User, name: User,
    property: Tag, "property name": Tag,
    type: Building2, "property type": Building2,
    location: MapPin, "property location": MapPin,
    gender: Users, "gender preference": Users,
  };

  const labelValue = (label: string, value: string): string => {
    const l = label.toLowerCase();
    if (l.includes("type")) return TYPE_LABELS[value] || value;
    if (l.includes("gender")) return GENDER_LABELS[value] || value;
    return value;
  };

  const fields = rawFields
    ? rawFields
        .filter((f) => f.value)
        .map((f) => ({
          icon: ICON_MAP[f.label.toLowerCase()] || Tag,
          label: f.label,
          value: labelValue(f.label, f.value),
        }))
    : [
        { icon: User, label: "Operator", value: user_name },
        { icon: Tag, label: "Property", value: property_name },
        { icon: Building2, label: "Type", value: property_type ? (TYPE_LABELS[property_type] || property_type) : undefined },
        { icon: Users, label: "Gender", value: gender ? (GENDER_LABELS[gender] || gender) : undefined },
        { icon: MapPin, label: "Location", value: property_location },
      ].filter((f) => f.value);

  return (
    <div className={cn(CARD, "my-2")}>
      <p className="text-xs font-medium text-content-tertiary mb-4">Property details</p>
      <div className="space-y-0">
        {fields.map((field, i) => (
          <div
            key={field.label}
            className={cn(
              "flex items-center justify-between py-3.5",
              i < fields.length - 1 && CARD_DIVIDER
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(ICON_CIRCLE, "bg-bg-elevated")}>
                <field.icon className="w-4 h-4 text-content-tertiary" />
              </div>
              <div>
                <p className="text-[11px] text-content-tertiary">{field.label}</p>
                <p className="text-sm text-content font-medium mt-0.5">{field.value}</p>
              </div>
            </div>
            <EditButton
              onClick={() => onSendMessage?.(`I want to change the ${field.label.toLowerCase()}, currently '${field.value}'`)}
            />
          </div>
        ))}
      </div>
      <div className="mt-5">
        <button
          onClick={() => onSendMessage?.("Looks good, let's continue to structure")}
          className={BTN_PRIMARY}
        >
          <span className="inline-flex items-center gap-2">
            Confirm & continue <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      </div>
    </div>
  );
}

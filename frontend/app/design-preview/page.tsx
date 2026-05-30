"use client";

/**
 * Design Preview v3 — Complete component catalog (all 25 registered + chat shell).
 * Every component refined to "RentOk Manager dark mode" product standard.
 */

import { useState } from "react";
import {
  MapPin, Building2, User, Tag, Check, Snowflake, Fan,
  ArrowRight, SquarePen, BedDouble, Hotel, Home, Box, Users, Boxes,
  UtensilsCrossed, Sofa, Layers, Loader2, AlertCircle, AlertTriangle,
  ChevronDown, Sparkles,
} from "lucide-react";
import { cn } from "../lib/cn";
import { motion, AnimatePresence } from "framer-motion";

// ─── Shared Design Primitives ───────────────────────────────────────

const CARD = "bg-bg-surface border border-border rounded-2xl p-5";
const CARD_DIVIDER = "border-b border-border";
const PILL = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium";
const PILL_ACCENT = cn(PILL, "bg-accent/10 text-accent-lighter");
const BTN_PRIMARY = "w-full py-3 rounded-xl text-sm font-semibold bg-accent hover:bg-accent-light text-white transition-all active:scale-[0.98] cursor-pointer";
const BTN_SECONDARY = "py-2.5 px-4 rounded-xl text-sm font-medium text-content-secondary border border-border hover:bg-bg-elevated transition-all active:scale-[0.98] cursor-pointer";
const BTN_GHOST = "py-2.5 px-4 rounded-xl text-sm font-medium text-accent-lighter hover:bg-accent/8 transition-all active:scale-[0.98] cursor-pointer";
const ICON_CIRCLE = "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0";
const ICON_SM = "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0";

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="pt-14 pb-4 border-b border-border mb-5">
      <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">
        {label}
        {count !== undefined && <span className="text-content-tertiary/50 ml-2">({count})</span>}
      </h2>
    </div>
  );
}

function ComponentLabel({ name }: { name: string }) {
  return <p className="text-[10px] font-mono text-content-tertiary/50 mb-2 px-1">{name}</p>;
}

function ToggleRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] text-content-tertiary mb-2">{label}</p>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all border cursor-pointer",
              value === o.v
                ? "border-accent/30 bg-accent/8 text-accent-lighter"
                : "border-border bg-bg-elevated text-content-tertiary hover:bg-bg-subtle"
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full flex items-center justify-center text-content-tertiary hover:text-accent-lighter hover:bg-bg-elevated transition-all cursor-pointer"
      aria-label="Edit"
    >
      <SquarePen className="w-3.5 h-3.5" />
    </button>
  );
}

function AttrChip({ icon: Icon, label, variant = "neutral" }: {
  icon: typeof Snowflake;
  label: string;
  variant?: "neutral" | "accent" | "info" | "success" | "warning";
}) {
  const styles = {
    neutral: "bg-bg-elevated text-content-secondary",
    accent: "bg-accent/10 text-accent-lighter",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <span className={cn(PILL, styles[variant])}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════
// FOUNDATION COMPONENTS (5)
// ═════════════════════════════════════════════════════════════════════

// ─── 1. ToolActivityIndicator ───────────────────────────────────────

function RevisedToolActivity() {
  return (
    <div className="space-y-3">
      {/* Running */}
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-bg-surface border border-border">
        <Loader2 className="w-3.5 h-3.5 text-accent-lighter animate-spin" />
        <span className="text-xs text-content-secondary">Checking your progress...</span>
      </div>
      {/* Complete */}
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-bg-surface border border-border">
        <Check className="w-3.5 h-3.5 text-success" />
        <span className="text-xs text-success">Saved your information</span>
      </div>
      {/* Error */}
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-bg-surface border border-border">
        <AlertCircle className="w-3.5 h-3.5 text-error" />
        <span className="text-xs text-error">Something went wrong</span>
      </div>
    </div>
  );
}

// ─── 2. QuickReplyChips ─────────────────────────────────────────────

function RevisedQuickReplies() {
  const [selected, setSelected] = useState<string | null>(null);
  const options = [
    { label: "Yes, looks good", icon: Check },
    { label: "Make a change", icon: SquarePen },
    { label: "Show saved progress", icon: Layers },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto py-3 px-1">
      {options.map((opt) => {
        const isSelected = selected === opt.label;
        return (
          <button
            key={opt.label}
            onClick={() => setSelected(opt.label)}
            className={cn(
              "flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
              "border active:scale-[0.97]",
              isSelected
                ? "border-accent bg-accent text-white"
                : "border-border text-content-secondary hover:bg-bg-elevated hover:border-border-strong"
            )}
          >
            <opt.icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── 3. DataConfirmationCard ────────────────────────────────────────

function RevisedDataConfirmation() {
  return (
    <div className="bg-success/5 border border-success/15 rounded-2xl p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn(ICON_SM, "bg-success/12")}>
          <Check className="w-3.5 h-3.5 text-success" />
        </div>
        <p className="text-sm font-medium text-success">Information saved</p>
      </div>
      <div className="pl-8 space-y-2">
        {[
          { label: "Property", value: "Sunrise PG" },
          { label: "Location", value: "Koramangala, Bangalore" },
        ].map((f) => (
          <div key={f.label} className="flex items-center justify-between">
            <span className="text-xs text-content-tertiary">{f.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-content font-medium">{f.value}</span>
              <EditButton />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 4. StageTransitionCard ─────────────────────────────────────────

function RevisedStageTransition() {
  return (
    <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Completed stage */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn(ICON_SM, "bg-success/12")}>
            <Check className="w-3.5 h-3.5 text-success" />
          </div>
          <div>
            <p className="text-xs text-content-tertiary">Completed</p>
            <p className="text-sm font-medium text-content">Introduction</p>
          </div>
        </div>
      </div>
      {/* Next stage */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(ICON_SM, "bg-accent/12")}>
            <ArrowRight className="w-3.5 h-3.5 text-accent-lighter" />
          </div>
          <div>
            <p className="text-xs text-content-tertiary">Next up</p>
            <p className="text-sm font-medium text-content">Property Structure</p>
            <p className="text-[11px] text-content-tertiary mt-0.5">Define floors, rooms, and naming</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 5. ErrorRecoveryCard ───────────────────────────────────────────

function RevisedErrorRecovery() {
  return (
    <div className="bg-error/5 border border-error/15 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(ICON_CIRCLE, "bg-error/10")}>
          <AlertTriangle className="w-4 h-4 text-error" />
        </div>
        <div>
          <p className="text-sm font-semibold text-content">Something went wrong</p>
          <p className="text-xs text-content-tertiary mt-0.5">Couldn&apos;t save your data. Your info is safe.</p>
        </div>
      </div>
      <div className="flex gap-2.5 mt-4">
        <button className={cn(BTN_SECONDARY, "flex-1")}>Show what&apos;s saved</button>
        <button className={cn(BTN_PRIMARY, "flex-1 bg-error hover:bg-error/80")}>
          <span className="inline-flex items-center gap-2">Try again <ArrowRight className="w-4 h-4" /></span>
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// INTRO STAGE (3)
// ═════════════════════════════════════════════════════════════════════

// ─── 6. WelcomeHero ─────────────────────────────────────────────────

function RevisedWelcomeHero() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-bg-surface via-bg-surface to-accent/5 border border-border p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg mx-auto mb-3">
        T
      </div>
      <h2 className="text-base font-semibold text-content">Tarini</h2>
      <p className="text-xs text-content-tertiary mt-1">Property Onboarding Specialist</p>
    </div>
  );
}

// ─── 7. PropertyTypeSelector ────────────────────────────────────────

function RevisedPropertyTypeSelector() {
  const [selected, setSelected] = useState<string | null>(null);
  const types = [
    { id: "pg", label: "PG", sub: "Paying Guest", icon: BedDouble },
    { id: "hostel", label: "Hostel", sub: "Dormitory", icon: Hotel },
    { id: "flat", label: "Flat", sub: "Apartment", icon: Home },
    { id: "studio", label: "Studio", sub: "Single unit", icon: Box },
    { id: "coliving", label: "Co-Living", sub: "Shared", icon: Users },
    { id: "mixed", label: "Mixed", sub: "Multiple", icon: Boxes },
  ];
  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-1">Select property type</p>
      <p className="text-[11px] text-content-tertiary/70 mb-4">This helps Tarini suggest the right setup</p>
      <div className="grid grid-cols-3 gap-2.5">
        {types.map((t) => {
          const isSelected = selected === t.id;
          const hasSelection = !!selected;
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={cn(
                "flex flex-col items-center gap-2 py-4 px-3 rounded-xl transition-all",
                "border cursor-pointer active:scale-[0.97]",
                isSelected
                  ? "border-accent bg-accent/8 ring-1 ring-accent/20"
                  : hasSelection
                    ? "border-border bg-bg-elevated opacity-40"
                    : "border-border bg-bg-elevated hover:bg-bg-subtle hover:border-border-strong"
              )}
            >
              <t.icon className={cn("w-5 h-5", isSelected ? "text-accent-lighter" : "text-content-tertiary")} />
              <div className="text-center">
                <span className={cn("text-sm font-medium block", isSelected ? "text-content" : "text-content-secondary")}>{t.label}</span>
                <span className="text-[10px] text-content-tertiary">{t.sub}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 8. IntroSummaryCard ────────────────────────────────────────────

function RevisedIntroSummary() {
  const fields = [
    { icon: User, label: "Owner", value: "Ramesh" },
    { icon: Building2, label: "Property", value: "Sunrise PG" },
    { icon: Tag, label: "Type", value: "PG / Paying Guest" },
    { icon: MapPin, label: "Location", value: "Koramangala, Bangalore" },
  ];
  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">Property details</p>
      <div className="space-y-0">
        {fields.map((f, i) => (
          <div key={f.label} className={cn("flex items-center justify-between py-3.5", i < fields.length - 1 && CARD_DIVIDER)}>
            <div className="flex items-center gap-3">
              <div className={cn(ICON_CIRCLE, "bg-bg-elevated")}><f.icon className="w-4 h-4 text-content-tertiary" /></div>
              <div>
                <p className="text-[11px] text-content-tertiary">{f.label}</p>
                <p className="text-sm text-content font-medium mt-0.5">{f.value}</p>
              </div>
            </div>
            <EditButton />
          </div>
        ))}
      </div>
      <div className="mt-5">
        <button className={BTN_PRIMARY}><span className="inline-flex items-center gap-2">Confirm &amp; continue <ArrowRight className="w-4 h-4" /></span></button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// STRUCTURE STAGE (5)
// ═════════════════════════════════════════════════════════════════════

// ─── 9. FloorBuilder ────────────────────────────────────────────────

function RevisedFloorBuilder() {
  const floors = [
    { label: "2nd Floor", rooms: 5, range: "201–205", categories: "PG rooms" },
    { label: "1st Floor", rooms: 5, range: "101–105", categories: "PG rooms" },
    { label: "Ground Floor", rooms: 5, range: "001–005", categories: "PG rooms" },
  ];
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-content-tertiary">Building structure</p>
        <span className="text-sm font-bold text-content">15 rooms</span>
      </div>
      <div className="space-y-1.5">
        {floors.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className="flex items-center gap-3 py-3 px-4 rounded-xl bg-bg-elevated hover:bg-bg-subtle transition-colors cursor-pointer"
          >
            <div className={cn(ICON_SM, "bg-accent/10 text-accent-lighter text-[10px] font-bold")}>
              {i === 2 ? "G" : 3 - i - 1}
            </div>
            <div className="flex-1">
              <p className="text-sm text-content font-medium">{f.label}</p>
              <p className="text-[11px] text-content-tertiary">{f.rooms} {f.categories} · {f.range}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── 10. UnitCountInput ─────────────────────────────────────────────

function RevisedUnitCountInput() {
  const [count, setCount] = useState(5);
  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-1">Ground Floor</p>
      <p className="text-[11px] text-content-tertiary/70 mb-4">How many rooms on this floor?</p>
      <div className="flex items-center justify-center gap-5 py-3">
        <button
          onClick={() => setCount(Math.max(1, count - 1))}
          className="w-11 h-11 rounded-full border border-border bg-bg-elevated hover:bg-bg-subtle flex items-center justify-center text-lg text-content-secondary transition-all active:scale-95 cursor-pointer"
        >−</button>
        <span className="text-3xl font-bold text-content w-12 text-center">{count}</span>
        <button
          onClick={() => setCount(Math.min(50, count + 1))}
          className="w-11 h-11 rounded-full border border-border bg-bg-elevated hover:bg-bg-subtle flex items-center justify-center text-lg text-content-secondary transition-all active:scale-95 cursor-pointer"
        >+</button>
      </div>
      <div className="flex gap-2 justify-center mt-3 mb-4">
        {[4, 5, 6, 8, 10].map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
              count === n ? "bg-accent/10 text-accent-lighter border border-accent/20" : "bg-bg-elevated text-content-tertiary border border-border hover:bg-bg-subtle"
            )}
          >{n}</button>
        ))}
      </div>
      <button className={BTN_PRIMARY}><span className="inline-flex items-center gap-2">Set {count} rooms <ArrowRight className="w-4 h-4" /></span></button>
    </div>
  );
}

// ─── 11. NamingPreview ──────────────────────────────────────────────

function RevisedNamingPreview() {
  const names = ["001", "002", "003", "004", "005"];
  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-1">Room names</p>
      <p className="text-[11px] text-content-tertiary/70 mb-4">Ground Floor — three-digit numbering</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {names.map((n) => (
          <span key={n} className="px-3 py-2 rounded-lg bg-bg-elevated border border-border text-sm text-content font-mono font-medium">{n}</span>
        ))}
      </div>
      <div className="flex gap-2.5">
        <button className={cn(BTN_GHOST, "flex-1")}>Custom pattern</button>
        <button className={cn(BTN_PRIMARY, "flex-1")}><span className="inline-flex items-center gap-2">Use these names <Check className="w-4 h-4" /></span></button>
      </div>
    </div>
  );
}

// ─── 12. FloorMilestoneReceipt ──────────────────────────────────────

function RevisedFloorReceipt() {
  return (
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-success/5 border border-success/12">
      <div className={cn(ICON_SM, "bg-success/12")}><Check className="w-3 h-3 text-success" /></div>
      <p className="text-sm text-content">
        <span className="font-medium">Ground Floor:</span>
        <span className="text-content-secondary ml-1">5 rooms (001–005)</span>
      </p>
    </div>
  );
}

// ─── 13. StructureSummaryCard ───────────────────────────────────────

function RevisedStructureSummary() {
  const floors = [
    { label: "Ground Floor", rooms: 5, range: "001–005" },
    { label: "1st Floor", rooms: 5, range: "101–105" },
    { label: "2nd Floor", rooms: 5, range: "201–205" },
  ];
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-medium text-content-tertiary">Structure</p>
          <p className="text-base font-semibold text-content mt-1">Sunrise PG</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-content">15</p>
          <p className="text-[11px] text-content-tertiary">rooms</p>
        </div>
      </div>
      <div className="space-y-0">
        {floors.map((f, i) => (
          <div key={f.label} className={cn("flex items-center justify-between py-3.5", i < floors.length - 1 && CARD_DIVIDER)}>
            <div className="flex items-center gap-3">
              <div className={cn(ICON_CIRCLE, "bg-bg-elevated")}><Layers className="w-4 h-4 text-content-tertiary" /></div>
              <div>
                <p className="text-sm text-content font-medium">{f.label}</p>
                <p className="text-[11px] text-content-tertiary mt-0.5">{f.rooms} rooms · {f.range}</p>
              </div>
            </div>
            <div className={cn(ICON_SM, "bg-success/12")}><Check className="w-3 h-3 text-success" /></div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <button className={BTN_PRIMARY}><span className="inline-flex items-center gap-2">Confirm &amp; continue <ArrowRight className="w-4 h-4" /></span></button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// PACKAGES STAGE (4)
// ═════════════════════════════════════════════════════════════════════

// ─── 14. PackageSuggestionCard ──────────────────────────────────────

function RevisedPackageSuggestion() {
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const suggestions = [
    { name: "AC Double Sharing", rent: 8500, ac: true, food: "Optional", furnishing: "Fully Furnished" },
    { name: "Non-AC Double Sharing", rent: 5500, ac: false, food: "None", furnishing: "Semi Furnished" },
  ];
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-accent-lighter" />
        <p className="text-xs font-medium text-content-tertiary">Suggested packages</p>
      </div>
      <p className="text-[11px] text-content-tertiary/70 mb-4">Based on PGs in Koramangala</p>
      <div className="space-y-3">
        {suggestions.map((pkg, i) => {
          const isAccepted = accepted.has(i);
          return (
            <div key={i} className={cn("rounded-xl border p-4 transition-all", isAccepted ? "border-success/25 bg-success/4" : "border-border bg-bg-elevated")}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-content">{pkg.name}</p>
                  <p className="text-xl font-bold text-content mt-1">
                    <span className="text-base font-semibold text-content-secondary">₹</span>
                    {pkg.rent.toLocaleString("en-IN")}
                    <span className="text-xs text-content-tertiary font-normal ml-0.5">/month</span>
                  </p>
                </div>
                <div className={cn(ICON_CIRCLE, pkg.ac ? "bg-info/10" : "bg-bg-subtle")}>
                  {pkg.ac ? <Snowflake className="w-4 h-4 text-info" /> : <Fan className="w-4 h-4 text-content-tertiary" />}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-4">
                <AttrChip icon={pkg.ac ? Snowflake : Fan} label={pkg.ac ? "AC" : "Non-AC"} variant={pkg.ac ? "info" : "neutral"} />
                <AttrChip icon={UtensilsCrossed} label={pkg.food === "None" ? "No meals" : `Meals ${pkg.food.toLowerCase()}`} variant="neutral" />
                <AttrChip icon={Sofa} label={pkg.furnishing} variant="neutral" />
              </div>
              {!isAccepted ? (
                <button onClick={() => setAccepted((prev) => new Set([...prev, i]))} className="w-full py-2.5 rounded-xl text-sm font-medium text-accent-lighter border border-accent/20 hover:bg-accent/8 transition-all active:scale-[0.98] cursor-pointer">Accept this package</button>
              ) : (
                <div className="flex items-center gap-2 py-2.5">
                  <div className={cn(ICON_SM, "bg-success/12")}><Check className="w-3 h-3 text-success" /></div>
                  <span className="text-sm text-success font-medium">Added</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {accepted.size > 0 && <button className={cn(BTN_PRIMARY, "mt-4")}><span className="inline-flex items-center gap-2">Continue with {accepted.size} package{accepted.size > 1 ? "s" : ""} <ArrowRight className="w-4 h-4" /></span></button>}
    </div>
  );
}

// ─── 15. PackageForm (2-step) ───────────────────────────────────────

function RevisedPackageForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("AC Double Sharing");
  const [sharing, setSharing] = useState("double");
  const [ac, setAc] = useState(true);
  const [food, setFood] = useState("optional");
  const [furnishing, setFurnishing] = useState("fully");
  const [rent, setRent] = useState("8500");

  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">New package</p>
      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] text-content-tertiary mb-2">Package name</p>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-content placeholder-content-tertiary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20" />
          </div>
          <ToggleRow label="Room type" options={[{ v: "private", l: "Private" }, { v: "double", l: "Double" }, { v: "triple", l: "Triple" }, { v: "dorm", l: "Dorm" }]} value={sharing} onChange={setSharing} />
          <button onClick={() => setStep(2)} className={BTN_PRIMARY}><span className="inline-flex items-center gap-2">Next — pricing &amp; amenities <ArrowRight className="w-4 h-4" /></span></button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setStep(1)} className="text-xs text-content-tertiary hover:text-accent-lighter transition-colors cursor-pointer">← Back</button>
            <span className={PILL_ACCENT}>{name}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-content-secondary">Air Conditioning</span>
            <button onClick={() => setAc(!ac)} role="switch" aria-checked={ac} className={cn("w-11 h-6 rounded-full transition-all duration-200 relative cursor-pointer", ac ? "bg-accent" : "bg-bg-subtle")}>
              <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200" style={{ left: ac ? "22px" : "2px" }} />
            </button>
          </div>
          <ToggleRow label="Food" options={[{ v: "included", l: "Included" }, { v: "optional", l: "Optional" }, { v: "none", l: "No food" }]} value={food} onChange={setFood} />
          <ToggleRow label="Furnishing" options={[{ v: "fully", l: "Fully" }, { v: "semi", l: "Semi" }, { v: "unfurnished", l: "Unfurn." }]} value={furnishing} onChange={setFurnishing} />
          <div>
            <p className="text-[11px] text-content-tertiary mb-2">Starting rent</p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-content-tertiary font-medium">₹</span>
              <input type="number" value={rent} onChange={(e) => setRent(e.target.value)} className="flex-1 px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-content focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20" />
              <span className="text-xs text-content-tertiary">/month</span>
            </div>
          </div>
          <button className={BTN_PRIMARY}><span className="inline-flex items-center gap-2">Save package <Check className="w-4 h-4" /></span></button>
        </div>
      )}
    </div>
  );
}

// ─── 16. PackageReceipt ─────────────────────────────────────────────

function RevisedPackageReceipt() {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3.5 rounded-xl bg-success/5 border border-success/12">
      <div className={cn(ICON_SM, "bg-success/12")}><Check className="w-3 h-3 text-success" /></div>
      <div className="flex-1">
        <p className="text-sm text-content font-medium">AC Double Sharing</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Snowflake className="w-3 h-3 text-info" />
        <span className="text-sm font-semibold text-content">₹8,500</span>
      </div>
    </div>
  );
}

// ─── 17. PackageList ────────────────────────────────────────────────

function RevisedPackageList() {
  const [editing, setEditing] = useState<number | null>(null);
  const packages = [
    { name: "AC Double Sharing", rent: 8500, ac: true, food: "Optional", furnishing: "Fully Furnished" },
    { name: "Non-AC Double", rent: 5500, ac: false, food: "None", furnishing: "Semi Furnished" },
  ];
  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">Your packages</p>
      <div className="space-y-2">
        {packages.map((pkg, i) => (
          <div key={i} className="rounded-xl border border-border bg-bg-elevated">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className={cn(ICON_SM, pkg.ac ? "bg-info/10" : "bg-bg-subtle")}>
                  {pkg.ac ? <Snowflake className="w-3 h-3 text-info" /> : <Fan className="w-3 h-3 text-content-tertiary" />}
                </div>
                <div>
                  <p className="text-sm text-content font-medium">{pkg.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-content-secondary">₹{pkg.rent.toLocaleString("en-IN")}/mo</span>
                    <span className="text-content-tertiary">·</span>
                    <span className="text-xs text-content-tertiary">{pkg.furnishing}</span>
                  </div>
                </div>
              </div>
              <EditButton onClick={() => setEditing(editing === i ? null : i)} />
            </div>
            <AnimatePresence>
              {editing === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-content-tertiary">Rent</span>
                      <span className="text-sm text-content font-medium">₹{pkg.rent.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-content-tertiary">Food</span>
                      <span className="text-sm text-content">{pkg.food === "None" ? "No meals" : pkg.food}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// MAPPING STAGE (5)
// ═════════════════════════════════════════════════════════════════════

// ─── 18. MappingSuggestionCard ──────────────────────────────────────

function RevisedMappingSuggestion() {
  const mappings = [
    { floor: "Ground Floor", rooms: 5, package: "AC Double Sharing" },
    { floor: "1st Floor", rooms: 5, package: "AC Double Sharing" },
    { floor: "2nd Floor", rooms: 5, package: "Non-AC Double" },
  ];
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-accent-lighter" />
        <p className="text-xs font-medium text-content-tertiary">Suggested mapping</p>
      </div>
      <p className="text-[11px] text-content-tertiary/70 mb-4">Assign rooms to packages</p>
      <div className="space-y-2">
        {mappings.map((m, i) => (
          <div key={i} className="flex items-center gap-3 py-3.5 px-4 rounded-xl bg-bg-elevated">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-content font-medium">{m.floor}</p>
              <p className="text-[11px] text-content-tertiary mt-0.5">{m.rooms} rooms</p>
            </div>
            <div className={cn(ICON_SM, "bg-bg-subtle")}><ArrowRight className="w-3 h-3 text-content-tertiary" /></div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-sm text-content font-medium">{m.package}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-5">
        <button className={cn(BTN_SECONDARY, "flex-1")}>Adjust</button>
        <button className={cn(BTN_PRIMARY, "flex-1")}><span className="inline-flex items-center gap-2">Apply <ArrowRight className="w-4 h-4" /></span></button>
      </div>
    </div>
  );
}

// ─── 19. FloorMappingRow ────────────────────────────────────────────

function RevisedFloorMappingRow() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rooms = ["001", "002", "003", "004", "005"];
  const toggle = (r: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    return next;
  });
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-content font-semibold">Ground Floor</p>
          <p className="text-[11px] text-content-tertiary mt-0.5">{selected.size}/{rooms.length} selected</p>
        </div>
        <button onClick={() => setSelected(new Set(rooms))} className="text-xs text-accent-lighter hover:underline cursor-pointer">Select all</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {rooms.map((r) => {
          const isSel = selected.has(r);
          return (
            <button key={r} onClick={() => toggle(r)} className={cn("px-3.5 py-2.5 rounded-lg text-sm font-mono font-medium transition-all cursor-pointer border", isSel ? "border-accent bg-accent/10 text-accent-lighter ring-1 ring-accent/20" : "border-border border-dashed bg-bg-elevated text-content-tertiary hover:bg-bg-subtle")}>
              {r}
            </button>
          );
        })}
      </div>
      {selected.size > 0 && (
        <button className={BTN_PRIMARY}><span className="inline-flex items-center gap-2">Assign {selected.size} rooms to package <ArrowRight className="w-4 h-4" /></span></button>
      )}
    </div>
  );
}

// ─── 20. MappingMatrix ──────────────────────────────────────────────

function RevisedMappingMatrix() {
  const floors = [
    { label: "Ground", total: 5, segments: [{ pkg: "AC Double", count: 5, color: "bg-accent/30" }] },
    { label: "1st", total: 5, segments: [{ pkg: "AC Double", count: 3, color: "bg-accent/30" }, { pkg: "Unmapped", count: 2, color: "bg-warning/20 border border-dashed border-warning/30" }] },
    { label: "2nd", total: 5, segments: [{ pkg: "Non-AC", count: 5, color: "bg-info/20" }] },
  ];
  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">Mapping overview</p>
      <div className="space-y-3">
        {floors.map((f) => (
          <div key={f.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-content-secondary font-medium">{f.label}</span>
              <span className="text-[11px] text-content-tertiary">{f.total} rooms</span>
            </div>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              {f.segments.map((s, j) => (
                <div key={j} className={cn("rounded-full", s.color)} style={{ flex: s.count }} title={`${s.pkg}: ${s.count}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 21. BulkMappingPreview ─────────────────────────────────────────

function RevisedBulkMappingPreview() {
  return (
    <div className="bg-warning/5 border border-warning/15 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(ICON_CIRCLE, "bg-warning/10")}><AlertTriangle className="w-4 h-4 text-warning" /></div>
        <div>
          <p className="text-sm font-semibold text-content">Confirm bulk mapping</p>
          <p className="text-[11px] text-content-tertiary mt-0.5">This will assign packages to 15 rooms across 3 floors</p>
        </div>
      </div>
      <div className="space-y-2 mb-5">
        {[
          { floor: "Ground + 1st Floor", rooms: 10, pkg: "AC Double Sharing" },
          { floor: "2nd Floor", rooms: 5, pkg: "Non-AC Double" },
        ].map((op, i) => (
          <div key={i} className="flex items-center gap-3 py-3 px-4 rounded-xl bg-bg-surface/50 border border-border">
            <div className="flex-1"><p className="text-sm text-content">{op.floor}</p><p className="text-[11px] text-content-tertiary">{op.rooms} rooms</p></div>
            <ArrowRight className="w-3.5 h-3.5 text-content-tertiary" />
            <p className="text-sm text-content font-medium">{op.pkg}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button className={cn(BTN_SECONDARY, "flex-1")}>Go back</button>
        <button className={cn(BTN_PRIMARY, "flex-1")}><span className="inline-flex items-center gap-2">Confirm <Check className="w-4 h-4" /></span></button>
      </div>
    </div>
  );
}

// ─── 22. UnmappedUnitsWarning ───────────────────────────────────────

function RevisedUnmappedWarning() {
  return (
    <div className="bg-warning/5 border border-warning/15 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(ICON_CIRCLE, "bg-warning/10")}><AlertCircle className="w-4 h-4 text-warning" /></div>
        <div>
          <p className="text-sm font-semibold text-content">2 rooms unmapped</p>
          <p className="text-[11px] text-content-tertiary mt-0.5">Assign a package to continue</p>
        </div>
      </div>
      <div className="pl-12 space-y-1.5 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-secondary">1st Floor</span>
          <span className="text-xs text-content-tertiary">· Rooms 104, 105</span>
        </div>
      </div>
      <button className={cn(BTN_GHOST, "w-full")}><span className="inline-flex items-center gap-2">Help me assign these rooms <ArrowRight className="w-4 h-4" /></span></button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// VERIFICATION STAGE (3)
// ═════════════════════════════════════════════════════════════════════

// ─── 23. VerificationSummary ────────────────────────────────────────

function RevisedVerification() {
  const [expanded, setExpanded] = useState<string | null>("property");
  const sections = [
    { id: "property", label: "Property", icon: Building2, summary: "Sunrise PG · Koramangala", items: [{ l: "Owner", v: "Ramesh" }, { l: "Type", v: "PG" }, { l: "Location", v: "Koramangala" }] },
    { id: "structure", label: "Structure", icon: Layers, summary: "3 floors · 15 rooms", items: [{ l: "Ground", v: "5 rooms" }, { l: "1st", v: "5 rooms" }, { l: "2nd", v: "5 rooms" }] },
    { id: "packages", label: "Packages", icon: Box, summary: "2 packages", items: [{ l: "AC Double", v: "₹8,500" }, { l: "Non-AC", v: "₹5,500" }] },
  ];
  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">Final review</p>
      <div className="space-y-0">
        {sections.map((s, i) => {
          const isExp = expanded === s.id;
          return (
            <div key={s.id} className={cn(i < sections.length - 1 && CARD_DIVIDER)}>
              <button onClick={() => setExpanded(isExp ? null : s.id)} className="flex items-center justify-between w-full py-3.5 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={cn(ICON_CIRCLE, "bg-bg-elevated")}><s.icon className="w-4 h-4 text-content-tertiary" /></div>
                  <div className="text-left">
                    <p className="text-sm text-content font-medium">{s.label}</p>
                    {!isExp && <p className="text-[11px] text-content-tertiary mt-0.5">{s.summary}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(ICON_SM, "bg-success/12")}><Check className="w-3 h-3 text-success" /></div>
                  <ChevronDown className={cn("w-4 h-4 text-content-tertiary transition-transform", isExp && "rotate-180")} />
                </div>
              </button>
              <AnimatePresence>
                {isExp && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                    <div className="pl-12 pb-3 space-y-2.5">
                      {s.items.map((item) => (
                        <div key={item.l} className="flex items-center justify-between">
                          <span className="text-xs text-content-tertiary">{item.l}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-content font-medium">{item.v}</span>
                            <EditButton />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <div className="mt-5">
        <button className={BTN_PRIMARY}><span className="inline-flex items-center gap-2">Confirm &amp; finish <Check className="w-4 h-4" /></span></button>
      </div>
    </div>
  );
}

// ─── 24. PendingItemsList ───────────────────────────────────────────

function RevisedPendingItems() {
  const items = [
    { label: "Set starting rent for Non-AC package", stage: "packages" },
    { label: "Map rooms 104, 105 to a package", stage: "mapping" },
  ];
  return (
    <div className="bg-warning/5 border border-warning/15 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-4 h-4 text-warning" />
        <p className="text-sm font-medium text-content">{items.length} items to resolve</p>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <button key={i} className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-bg-surface/50 border border-border hover:bg-bg-elevated transition-all cursor-pointer text-left active:scale-[0.98]">
            <div className="w-6 h-6 rounded-full bg-warning/12 flex items-center justify-center text-[11px] font-bold text-warning flex-shrink-0">{i + 1}</div>
            <div className="flex-1">
              <p className="text-sm text-content">{item.label}</p>
              <p className="text-[11px] text-content-tertiary mt-0.5 capitalize">{item.stage}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-content-tertiary" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 25. CompletionCelebration ──────────────────────────────────────

function RevisedCompletion() {
  return (
    <div className={cn(CARD, "text-center py-8")}>
      <div className="w-14 h-14 rounded-full bg-success/12 flex items-center justify-center mx-auto mb-4">
        <Check className="w-7 h-7 text-success" />
      </div>
      <h3 className="text-lg font-bold text-content mb-1">You&apos;re all set!</h3>
      <p className="text-sm text-content-secondary mb-6">Sunrise PG is ready to go live on RentOk</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[{ n: "3", l: "Floors" }, { n: "15", l: "Rooms" }, { n: "2", l: "Packages" }].map((s) => (
          <div key={s.l} className="py-3 rounded-xl bg-bg-elevated">
            <p className="text-xl font-bold text-content">{s.n}</p>
            <p className="text-[11px] text-content-tertiary mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2.5">
        <button className={BTN_PRIMARY}><span className="inline-flex items-center gap-2">Go to dashboard <ArrowRight className="w-4 h-4" /></span></button>
        <button className={cn(BTN_SECONDARY, "w-full")}>Add property photos</button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// CHAT SHELL
// ═════════════════════════════════════════════════════════════════════

function RevisedStageProgress() {
  const stages = [{ l: "Intro", s: "1" }, { l: "Structure", s: "2" }, { l: "Packages", s: "3" }, { l: "Mapping", s: "4" }, { l: "Verify", s: "5" }];
  const ci = 2;
  return (
    <div className="flex items-center justify-between px-3 py-3">
      {stages.map((st, i) => (
        <div key={st.l} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={cn("flex items-center justify-center rounded-full transition-all w-7 h-7 text-[11px] font-semibold", i < ci && "bg-success/15 text-success", i === ci && "bg-accent/15 text-accent-lighter ring-1.5 ring-accent/30", i > ci && "bg-bg-elevated text-content-tertiary")}>
              {i < ci ? <Check className="w-3.5 h-3.5" /> : st.s}
            </div>
            <span className={cn("text-[9px] font-medium", i === ci ? "text-accent-lighter" : "text-content-tertiary")}>{st.l}</span>
          </div>
          {i < stages.length - 1 && <div className={cn("w-5 h-[1.5px] mx-1 rounded-full mb-4", i < ci ? "bg-success/30" : "bg-border-strong")} />}
        </div>
      ))}
    </div>
  );
}

function RevisedChatPreview() {
  return (
    <div className="space-y-4 py-2">
      <div className="flex gap-3 max-w-xl">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">T</div>
        <div className="bg-bg-surface border border-border rounded-2xl rounded-tl-md px-4 py-3.5 text-sm text-content leading-relaxed">
          Hi Ramesh! I&apos;ve got your property details. Let me show you a summary.
        </div>
      </div>
      <div className="flex gap-3 justify-end max-w-xl ml-auto">
        <div className="bg-accent/10 border border-accent/20 rounded-2xl rounded-tr-md px-4 py-3.5 text-sm text-content leading-relaxed">Yes, that looks correct</div>
        <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-content-secondary text-xs font-semibold flex-shrink-0 mt-0.5">R</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════

export default function DesignPreview() {
  return (
    <div className="min-h-screen bg-bg-deep text-content">
      <div className="max-w-md mx-auto px-4 pb-20">
        <div className="pt-8 pb-4">
          <h1 className="text-xl font-bold text-content">Component Catalog</h1>
          <p className="text-sm text-content-tertiary mt-1">All 25 registered + chat shell — refined for production</p>
        </div>

        {/* Chat Shell */}
        <SectionHeader label="Chat Shell" count={3} />
        <ComponentLabel name="StageProgressBar" />
        <div className="bg-bg-surface border border-border rounded-2xl mb-4"><RevisedStageProgress /></div>
        <ComponentLabel name="MessageBubble" />
        <RevisedChatPreview />
        <ComponentLabel name="QuickReplyChips" />
        <RevisedQuickReplies />

        {/* Foundation */}
        <SectionHeader label="Foundation" count={5} />
        <ComponentLabel name="ToolActivityIndicator" />
        <RevisedToolActivity />
        <div className="h-4" />
        <ComponentLabel name="DataConfirmationCard" />
        <RevisedDataConfirmation />
        <div className="h-4" />
        <ComponentLabel name="StageTransitionCard" />
        <RevisedStageTransition />
        <div className="h-4" />
        <ComponentLabel name="ErrorRecoveryCard" />
        <RevisedErrorRecovery />

        {/* Intro */}
        <SectionHeader label="Intro Stage" count={3} />
        <ComponentLabel name="WelcomeHero" />
        <RevisedWelcomeHero />
        <div className="h-4" />
        <ComponentLabel name="PropertyTypeSelector" />
        <RevisedPropertyTypeSelector />
        <div className="h-4" />
        <ComponentLabel name="IntroSummaryCard" />
        <RevisedIntroSummary />

        {/* Structure */}
        <SectionHeader label="Structure Stage" count={5} />
        <ComponentLabel name="FloorBuilder" />
        <RevisedFloorBuilder />
        <div className="h-4" />
        <ComponentLabel name="UnitCountInput" />
        <RevisedUnitCountInput />
        <div className="h-4" />
        <ComponentLabel name="NamingPreview" />
        <RevisedNamingPreview />
        <div className="h-4" />
        <ComponentLabel name="FloorMilestoneReceipt" />
        <RevisedFloorReceipt />
        <div className="h-4" />
        <ComponentLabel name="StructureSummaryCard" />
        <RevisedStructureSummary />

        {/* Packages */}
        <SectionHeader label="Packages Stage" count={4} />
        <ComponentLabel name="PackageSuggestionCard" />
        <RevisedPackageSuggestion />
        <div className="h-4" />
        <ComponentLabel name="PackageForm" />
        <RevisedPackageForm />
        <div className="h-4" />
        <ComponentLabel name="PackageReceipt" />
        <RevisedPackageReceipt />
        <div className="h-4" />
        <ComponentLabel name="PackageList" />
        <RevisedPackageList />

        {/* Mapping */}
        <SectionHeader label="Mapping Stage" count={5} />
        <ComponentLabel name="MappingSuggestionCard" />
        <RevisedMappingSuggestion />
        <div className="h-4" />
        <ComponentLabel name="FloorMappingRow" />
        <RevisedFloorMappingRow />
        <div className="h-4" />
        <ComponentLabel name="MappingMatrix" />
        <RevisedMappingMatrix />
        <div className="h-4" />
        <ComponentLabel name="BulkMappingPreview" />
        <RevisedBulkMappingPreview />
        <div className="h-4" />
        <ComponentLabel name="UnmappedUnitsWarning" />
        <RevisedUnmappedWarning />

        {/* Verification */}
        <SectionHeader label="Verification Stage" count={3} />
        <ComponentLabel name="VerificationSummary" />
        <RevisedVerification />
        <div className="h-4" />
        <ComponentLabel name="PendingItemsList" />
        <RevisedPendingItems />
        <div className="h-4" />
        <ComponentLabel name="CompletionCelebration" />
        <RevisedCompletion />
      </div>
    </div>
  );
}

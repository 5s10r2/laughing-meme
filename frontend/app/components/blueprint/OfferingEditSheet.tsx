"use client";

import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { BTN_PRIMARY } from "../ui/primitives";
import type { PackageDetail } from "./PackagePanel";

/**
 * OfferingEditSheet — edit an offering's commercial terms directly (no LLM round-trip).
 * Emits a single UpdateOffering through the Blueprint's command layer; success surfaces the
 * shared toast + transcript note. Structural attrs (sharing/config) stay read-only here —
 * they define what the offering *is*; this sheet is for the terms that change often.
 */

const FOODS = ["none", "included", "optional"];
const FURNISHINGS = ["unfurnished", "semi_furnished", "fully_furnished"];

interface OfferingEditSheetProps {
  offering: PackageDetail | null;
  open: boolean;
  onClose: () => void;
  onApply: (commands: Record<string, unknown>[], summary: string) => void;
}

export function OfferingEditSheet({ offering, open, onClose, onApply }: OfferingEditSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={offering ? `Edit · ${offering.name}` : undefined}
      className="lp-theme"
    >
      {offering && <EditBody key={offering.id} offering={offering} onClose={onClose} onApply={onApply} />}
    </BottomSheet>
  );
}

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

function EditBody({
  offering,
  onClose,
  onApply,
}: {
  offering: PackageDetail;
  onClose: () => void;
  onApply: OfferingEditSheetProps["onApply"];
}) {
  const init = (v: number | null | undefined) => (v == null ? "" : String(v));
  const [rent, setRent] = useState(init(offering.rent));
  const [ac, setAc] = useState(!!offering.ac);
  const [food, setFood] = useState(offering.food ?? "none");
  const [furnishing, setFurnishing] = useState(offering.furnishing ?? "");
  const [deposit, setDeposit] = useState(init(offering.depositMonths));
  const [notice, setNotice] = useState(init(offering.noticeDays));
  const [lockIn, setLockIn] = useState(init(offering.lockInMonths));
  const [minStay, setMinStay] = useState(init(offering.minStay));

  function save() {
    const attrs: Record<string, unknown> = {
      ac,
      food,
      deposit_months: num(deposit),
      notice_days: num(notice),
      lock_in_months: num(lockIn),
      min_stay: num(minStay),
    };
    if (furnishing) attrs.furnishing = furnishing;
    onApply(
      [{ op: "UpdateOffering", offering_id: offering.id, price: num(rent), attrs }],
      `Updated ${offering.name}`
    );
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Rent (₹)">
        <NumInput value={rent} onChange={setRent} placeholder="e.g. 9000" />
      </Field>

      <div className="flex items-center justify-between">
        <span className="text-sm text-content">AC</span>
        <Toggle on={ac} onToggle={() => setAc((v) => !v)} />
      </div>

      <Field label="Food">
        <Select value={food} onChange={setFood} options={FOODS} />
      </Field>
      <Field label="Furnishing">
        <Select value={furnishing} onChange={setFurnishing} options={["", ...FURNISHINGS]} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Deposit (months)">
          <NumInput value={deposit} onChange={setDeposit} placeholder="e.g. 2" />
        </Field>
        <Field label="Notice (days)">
          <NumInput value={notice} onChange={setNotice} placeholder="e.g. 30" />
        </Field>
        <Field label="Lock-in (months)">
          <NumInput value={lockIn} onChange={setLockIn} placeholder="optional" />
        </Field>
        <Field label="Min stay (months)">
          <NumInput value={minStay} onChange={setMinStay} placeholder="optional" />
        </Field>
      </div>

      <button type="button" className={BTN_PRIMARY} onClick={save}>
        Save changes
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-content-tertiary uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

const INPUT =
  "w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-content focus:border-border-accent focus:outline-none";

function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "" ? "—" : o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-accent" : "bg-border-strong"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

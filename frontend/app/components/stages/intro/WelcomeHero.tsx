"use client";

import { Building2, Layers, Package, ArrowRightLeft, ShieldCheck } from "lucide-react";

const JOURNEY_STEPS = [
  { icon: Building2, label: "Property Info" },
  { icon: Layers, label: "Structure" },
  { icon: Package, label: "Packages" },
  { icon: ArrowRightLeft, label: "Mapping" },
  { icon: ShieldCheck, label: "Verify" },
];

export function WelcomeHero() {
  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/10 border border-zinc-800 rounded-xl px-4 py-4 my-1.5">
      {/* Identity */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 font-bold text-sm flex-shrink-0">
          T
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Tarini</h2>
          <p className="text-[11px] text-zinc-500">Property Onboarding Specialist</p>
        </div>
      </div>

      {/* Journey overview */}
      <div className="border-t border-zinc-800 pt-3 mt-1">
        <p className="text-[11px] text-zinc-500 mb-2.5 font-medium uppercase tracking-wider">
          Your onboarding journey
        </p>
        <div className="flex items-center justify-between">
          {JOURNEY_STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center">
                  <step.icon className="w-3.5 h-3.5 text-zinc-500" />
                </div>
                <span className="text-[9px] text-zinc-600">{step.label}</span>
              </div>
              {i < JOURNEY_STEPS.length - 1 && (
                <div className="w-3 h-px bg-zinc-800 mx-1 mb-4" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

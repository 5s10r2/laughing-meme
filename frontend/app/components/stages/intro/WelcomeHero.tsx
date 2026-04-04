"use client";

export function WelcomeHero() {
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

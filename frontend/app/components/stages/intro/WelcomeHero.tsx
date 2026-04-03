"use client";

export function WelcomeHero() {
  return (
    <div className="bg-gradient-to-br from-bg-deep via-bg-surface to-accent/5 border border-border rounded-[var(--radius-card)] px-4 py-4 my-1.5">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-bg-deep font-bold text-sm flex-shrink-0">
          T
        </div>
        <div>
          <h2 className="text-sm font-semibold text-content">Tarini</h2>
          <p className="text-xs text-content-tertiary">Property Onboarding Specialist</p>
        </div>
      </div>
    </div>
  );
}

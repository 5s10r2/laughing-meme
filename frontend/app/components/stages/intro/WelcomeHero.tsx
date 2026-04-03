"use client";

export function WelcomeHero() {
  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/10 border border-zinc-800 rounded-xl px-4 py-4 my-1.5">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 font-bold text-sm flex-shrink-0">
          T
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Tarini</h2>
          <p className="text-xs text-zinc-500">Property Onboarding Specialist</p>
        </div>
      </div>
    </div>
  );
}

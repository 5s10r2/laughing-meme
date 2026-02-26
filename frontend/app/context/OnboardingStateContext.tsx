"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { OnboardingState, Stage, SessionState } from "../lib/types";

interface OnboardingStateContextValue {
  /** Full onboarding state from the backend */
  sessionState: SessionState;
  /** Update the state from a state_snapshot SSE event */
  updateFromSnapshot: (state: OnboardingState, stage: Stage, stateVersion: number) => void;
  /** Update just the stage (from advance_stage tool_complete) */
  updateStage: (stage: Stage) => void;
}

const defaultSessionState: SessionState = {
  stage: "intro",
  state: {},
  stateVersion: 0,
};

const OnboardingStateContext = createContext<OnboardingStateContextValue>({
  sessionState: defaultSessionState,
  updateFromSnapshot: () => {},
  updateStage: () => {},
});

export function OnboardingStateProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<SessionState>(defaultSessionState);

  const updateFromSnapshot = useCallback(
    (state: OnboardingState, stage: Stage, stateVersion: number) => {
      setSessionState({ state, stage, stateVersion });
    },
    []
  );

  const updateStage = useCallback((stage: Stage) => {
    setSessionState((prev) => ({ ...prev, stage }));
  }, []);

  return (
    <OnboardingStateContext.Provider value={{ sessionState, updateFromSnapshot, updateStage }}>
      {children}
    </OnboardingStateContext.Provider>
  );
}

export function useOnboardingState() {
  return useContext(OnboardingStateContext);
}

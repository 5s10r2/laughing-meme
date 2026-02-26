// ── Onboarding Data Types ────────────────────────────────────────────────────

export interface Floor {
  index: number;
  label: string;
  active: boolean;
}

export interface Unit {
  id: string;
  name: string;
  floor_index: number;
  category: string;
  sharing_type?: string;
  bhk_variant?: string;
  package_id?: string;
  active: boolean;
}

export interface Package {
  id: string;
  name: string;
  category: string;
  sharing_type?: string;
  furnishing?: string;
  amenities?: string[];
  food_included?: boolean;
  food_optional?: boolean;
  starting_rent?: number;
  active: boolean;
  disabled?: boolean;
}

export interface OnboardingState {
  user_name?: string;
  property_name?: string;
  property_type?: string;
  property_location?: string;
  floors?: Floor[];
  units?: Unit[];
  packages?: Package[];
  naming_patterns?: Record<string, { pattern: string; start: number }>;
}

export type Stage = "intro" | "structure" | "packages" | "mapping" | "verification";

export interface SessionState {
  stage: Stage;
  state: OnboardingState;
  stateVersion: number;
}

// ── SSE Event Types ──────────────────────────────────────────────────────────

export interface SSETextEvent {
  type: "text";
  text: string;
}

export interface SSEComponentEvent {
  type: "component";
  name: string;
  props: Record<string, unknown>;
  id?: string;
}

export interface SSEToolStartEvent {
  type: "tool_start";
  tool: string;
  description?: string;
  id: string;
}

export interface SSEToolCompleteEvent {
  type: "tool_complete";
  tool: string;
  id: string;
  result: Record<string, unknown>;
}

export interface SSEStateSnapshotEvent {
  type: "state_snapshot";
  state: OnboardingState;
  stage: Stage;
  stateVersion: number;
}

export interface SSEQuickRepliesEvent {
  type: "quick_replies";
  options: QuickReplyOption[];
}

export interface SSEDoneEvent {
  type: "done";
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export interface SSEThinkingEvent {
  type: "thinking";
}

export type SSEEvent =
  | SSETextEvent
  | SSEComponentEvent
  | SSEToolStartEvent
  | SSEToolCompleteEvent
  | SSEStateSnapshotEvent
  | SSEQuickRepliesEvent
  | SSEDoneEvent
  | SSEErrorEvent
  | SSEThinkingEvent;

// ── Message Types ────────────────────────────────────────────────────────────

export interface TextPart {
  type: "text";
  text: string;
}

export interface ComponentPart {
  type: "component";
  componentName: string;
  props: Record<string, unknown>;
  componentId?: string;
}

export interface ToolActivityPart {
  type: "tool_activity";
  tool: string;
  toolStatus: "running" | "complete" | "error";
  toolDescription?: string;
  toolResult?: Record<string, unknown>;
  toolId: string;
}

export type MessagePart = TextPart | ComponentPart | ToolActivityPart;

export interface Message {
  id: string;
  role: "user" | "tarini";
  parts: MessagePart[];
  streaming?: boolean;
}

// ── Quick Reply Types ────────────────────────────────────────────────────────

export interface QuickReplyOption {
  label: string;
  value: string;
}

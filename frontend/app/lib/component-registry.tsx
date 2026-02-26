"use client";

import type { ComponentType } from "react";

// Foundation components
import { ToolActivityIndicator } from "../components/ui/ToolActivityIndicator";
import { QuickReplyChips } from "../components/ui/QuickReplyChips";
import { DataConfirmationCard } from "../components/ui/DataConfirmationCard";
import { StageTransitionCard } from "../components/ui/StageTransitionCard";
import { ErrorRecoveryCard } from "../components/ui/ErrorRecoveryCard";

// Intro components
import { WelcomeHero } from "../components/stages/intro/WelcomeHero";
import { PropertyTypeSelector } from "../components/stages/intro/PropertyTypeSelector";
import { IntroSummaryCard } from "../components/stages/intro/IntroSummaryCard";

// Structure components
import { FloorBuilder } from "../components/stages/structure/FloorBuilder";
import { UnitCountInput } from "../components/stages/structure/UnitCountInput";
import { NamingPreview } from "../components/stages/structure/NamingPreview";
import { FloorMilestoneReceipt } from "../components/stages/structure/FloorMilestoneReceipt";
import { StructureSummaryCard } from "../components/stages/structure/StructureSummaryCard";

// Package components
import { PackageSuggestionCard } from "../components/stages/packages/PackageSuggestionCard";
import { PackageForm } from "../components/stages/packages/PackageForm";
import { PackageReceipt } from "../components/stages/packages/PackageReceipt";
import { PackageList } from "../components/stages/packages/PackageList";

// Mapping components
import { MappingSuggestionCard } from "../components/stages/mapping/MappingSuggestionCard";
import { FloorMappingRow } from "../components/stages/mapping/FloorMappingRow";
import { MappingMatrix } from "../components/stages/mapping/MappingMatrix";
import { BulkMappingPreview } from "../components/stages/mapping/BulkMappingPreview";
import { UnmappedUnitsWarning } from "../components/stages/mapping/UnmappedUnitsWarning";

// Verification components
import { VerificationSummary } from "../components/stages/verification/VerificationSummary";
import { PendingItemsList } from "../components/stages/verification/PendingItemsList";
import { CompletionCelebration } from "../components/stages/verification/CompletionCelebration";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENT_REGISTRY: Record<string, ComponentType<any>> = {
  // Foundation
  ToolActivityIndicator,
  QuickReplyChips,
  DataConfirmationCard,
  StageTransitionCard,
  ErrorRecoveryCard,

  // Intro
  WelcomeHero,
  PropertyTypeSelector,
  IntroSummaryCard,

  // Structure
  FloorBuilder,
  UnitCountInput,
  NamingPreview,
  FloorMilestoneReceipt,
  StructureSummaryCard,

  // Packages
  PackageSuggestionCard,
  PackageForm,
  PackageReceipt,
  PackageList,

  // Mapping
  MappingSuggestionCard,
  FloorMappingRow,
  MappingMatrix,
  BulkMappingPreview,
  UnmappedUnitsWarning,

  // Verification
  VerificationSummary,
  PendingItemsList,
  CompletionCelebration,
};

/**
 * Render a component by name from the registry.
 * Returns null if the component is not found (graceful degradation).
 */
export function renderRegisteredComponent(
  name: string,
  props: Record<string, unknown>,
  sendMessage?: (text: string) => void
): React.ReactElement | null {
  const Component = COMPONENT_REGISTRY[name];
  if (!Component) {
    console.warn(`[component-registry] Unknown component: "${name}". Skipping render.`);
    return null;
  }
  return <Component {...props} onSendMessage={sendMessage} />;
}

/**
 * Check if a component name is registered.
 */
export function isRegisteredComponent(name: string): boolean {
  return name in COMPONENT_REGISTRY;
}

"use client";

import type { ComponentType } from "react";
import { adaptComponentProps } from "./component-adapters";

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

// Living Blueprint (v2) — props are projected from the model on the backend.
import { MassingModel } from "../components/blueprint/MassingModel";
import { FloorLedger } from "../components/blueprint/FloorLedger";
import { BlueprintMapping } from "../components/blueprint/BlueprintMapping";
import { UnmappedWarning } from "../components/blueprint/UnmappedWarning";

type RegistryComponent = ComponentType<Record<string, unknown>>;

const asRegistryComponent = (component: ComponentType<unknown>): RegistryComponent =>
  component as RegistryComponent;

const COMPONENT_REGISTRY: Record<string, RegistryComponent> = {
  // Foundation
  ToolActivityIndicator: asRegistryComponent(ToolActivityIndicator as ComponentType<unknown>),
  QuickReplyChips: asRegistryComponent(QuickReplyChips as ComponentType<unknown>),
  DataConfirmationCard: asRegistryComponent(DataConfirmationCard as ComponentType<unknown>),
  StageTransitionCard: asRegistryComponent(StageTransitionCard as ComponentType<unknown>),
  ErrorRecoveryCard: asRegistryComponent(ErrorRecoveryCard as ComponentType<unknown>),

  // Intro
  WelcomeHero: asRegistryComponent(WelcomeHero as ComponentType<unknown>),
  PropertyTypeSelector: asRegistryComponent(PropertyTypeSelector as ComponentType<unknown>),
  IntroSummaryCard: asRegistryComponent(IntroSummaryCard as ComponentType<unknown>),

  // Structure
  FloorBuilder: asRegistryComponent(FloorBuilder as ComponentType<unknown>),
  UnitCountInput: asRegistryComponent(UnitCountInput as ComponentType<unknown>),
  NamingPreview: asRegistryComponent(NamingPreview as ComponentType<unknown>),
  FloorMilestoneReceipt: asRegistryComponent(FloorMilestoneReceipt as ComponentType<unknown>),
  StructureSummaryCard: asRegistryComponent(StructureSummaryCard as ComponentType<unknown>),

  // Packages
  PackageSuggestionCard: asRegistryComponent(PackageSuggestionCard as ComponentType<unknown>),
  PackageForm: asRegistryComponent(PackageForm as ComponentType<unknown>),
  PackageReceipt: asRegistryComponent(PackageReceipt as ComponentType<unknown>),
  PackageList: asRegistryComponent(PackageList as ComponentType<unknown>),

  // Mapping
  MappingSuggestionCard: asRegistryComponent(MappingSuggestionCard as ComponentType<unknown>),
  FloorMappingRow: asRegistryComponent(FloorMappingRow as ComponentType<unknown>),
  MappingMatrix: asRegistryComponent(MappingMatrix as ComponentType<unknown>),
  BulkMappingPreview: asRegistryComponent(BulkMappingPreview as ComponentType<unknown>),
  UnmappedUnitsWarning: asRegistryComponent(UnmappedUnitsWarning as ComponentType<unknown>),

  // Verification
  VerificationSummary: asRegistryComponent(VerificationSummary as ComponentType<unknown>),
  PendingItemsList: asRegistryComponent(PendingItemsList as ComponentType<unknown>),
  CompletionCelebration: asRegistryComponent(CompletionCelebration as ComponentType<unknown>),

  // Living Blueprint (v2)
  MassingModel: asRegistryComponent(MassingModel as ComponentType<unknown>),
  FloorLedger: asRegistryComponent(FloorLedger as ComponentType<unknown>),
  BlueprintMapping: asRegistryComponent(BlueprintMapping as ComponentType<unknown>),
  UnmappedWarning: asRegistryComponent(UnmappedWarning as ComponentType<unknown>),
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
  return <Component {...adaptComponentProps(name, props)} onSendMessage={sendMessage} />;
}

/**
 * Check if a component name is registered.
 */
export function isRegisteredComponent(name: string): boolean {
  return name in COMPONENT_REGISTRY;
}

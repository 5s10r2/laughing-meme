"use client";

import { useState, useEffect } from "react";

// ── Foundation / Shared UI ──────────────────────────────────────────
import { ToolActivityIndicator } from "../components/ui/ToolActivityIndicator";
import { QuickReplyChips } from "../components/ui/QuickReplyChips";
import { DataConfirmationCard } from "../components/ui/DataConfirmationCard";
import { StageTransitionCard } from "../components/ui/StageTransitionCard";
import { ErrorRecoveryCard } from "../components/ui/ErrorRecoveryCard";

// ── Stage 1: Intro ──────────────────────────────────────────────────
import { WelcomeHero } from "../components/stages/intro/WelcomeHero";
import { PropertyTypeSelector } from "../components/stages/intro/PropertyTypeSelector";
import { IntroSummaryCard } from "../components/stages/intro/IntroSummaryCard";

// ── Stage 2: Structure ──────────────────────────────────────────────
import { FloorBuilder } from "../components/stages/structure/FloorBuilder";
import { UnitCountInput } from "../components/stages/structure/UnitCountInput";
import { NamingPreview } from "../components/stages/structure/NamingPreview";
import { FloorMilestoneReceipt } from "../components/stages/structure/FloorMilestoneReceipt";
import { StructureSummaryCard } from "../components/stages/structure/StructureSummaryCard";

// ── Stage 3: Packages ───────────────────────────────────────────────
import { PackageSuggestionCard } from "../components/stages/packages/PackageSuggestionCard";
import { PackageForm } from "../components/stages/packages/PackageForm";
import { PackageReceipt } from "../components/stages/packages/PackageReceipt";
import { PackageList } from "../components/stages/packages/PackageList";

// ── Stage 4: Mapping ────────────────────────────────────────────────
import { MappingSuggestionCard } from "../components/stages/mapping/MappingSuggestionCard";
import { FloorMappingRow } from "../components/stages/mapping/FloorMappingRow";
import { MappingMatrix } from "../components/stages/mapping/MappingMatrix";
import { BulkMappingPreview } from "../components/stages/mapping/BulkMappingPreview";
import { UnmappedUnitsWarning } from "../components/stages/mapping/UnmappedUnitsWarning";

// ── Stage 5: Verification ───────────────────────────────────────────
import { VerificationSummary } from "../components/stages/verification/VerificationSummary";
import { PendingItemsList } from "../components/stages/verification/PendingItemsList";
import { CompletionCelebration } from "../components/stages/verification/CompletionCelebration";

// ─────────────────────────────────────────────────────────────────────
// Component wrapper — shows a monospace label above each component
// ─────────────────────────────────────────────────────────────────────
function ShowcaseItem({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="text-[10px] text-zinc-600 font-mono mb-1 px-1">{name}</p>
      {children}
    </div>
  );
}

// Section header
function SectionHeader({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="pt-8 pb-3 border-b border-zinc-800/50 mb-4">
      <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
        {label}
        <span className="text-zinc-700 ml-2 font-normal">({count})</span>
      </h2>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main Showcase Page
// ─────────────────────────────────────────────────────────────────────
export default function ShowcasePage() {
  const [toast, setToast] = useState("");
  const [toastKey, setToastKey] = useState(0);

  // Mock onSendMessage — shows a toast at the bottom
  function mockSend(text: string) {
    setToast(text);
    setToastKey((k) => k + 1);
  }

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast, toastKey]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Page header */}
      <div className="max-w-[480px] mx-auto px-4 pt-8 pb-4">
        <h1 className="text-lg font-bold text-zinc-100 mb-1">
          Component Showcase
        </h1>
        <p className="text-xs text-zinc-500 mb-1">
          All 25 registered UI components rendered with realistic sample data.
        </p>
        <p className="text-[10px] text-zinc-700">
          Tap interactive buttons to see what message they would send (shown as a
          toast at the bottom).
        </p>
      </div>

      {/* Component showcase */}
      <div className="max-w-[480px] mx-auto px-4 pb-32">
        {/* ============================================================
            A. SHARED UI (5 components)
           ============================================================ */}
        <SectionHeader label="A. Shared UI" count={5} />

        <ShowcaseItem name="ToolActivityIndicator (running)">
          <ToolActivityIndicator
            tool="update_state"
            status="running"
            description="Saving your property details"
          />
        </ShowcaseItem>

        <ShowcaseItem name="ToolActivityIndicator (complete)">
          <ToolActivityIndicator
            tool="update_state"
            status="complete"
            description="Property details saved"
          />
        </ShowcaseItem>

        <ShowcaseItem name="ToolActivityIndicator (error)">
          <ToolActivityIndicator
            tool="validate_property_data"
            status="error"
            description="Validation failed"
          />
        </ShowcaseItem>

        <ShowcaseItem name="QuickReplyChips">
          <QuickReplyChips
            options={[
              { label: "Yes, that's correct", value: "Yes, that's correct" },
              { label: "No, let me change", value: "No, let me change" },
              { label: "Start over", value: "Start over" },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="DataConfirmationCard">
          <DataConfirmationCard
            title="Property Info Saved"
            fields={[
              { label: "Owner", value: "Sanchay" },
              { label: "Property", value: "Sunrise PG" },
              { label: "Type", value: "PG / Paying Guest" },
              { label: "Location", value: "Koramangala, Bangalore" },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="StageTransitionCard">
          <StageTransitionCard
            completedStage="structure"
            nextStage="packages"
            summary="3 floors, 15 rooms configured"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="ErrorRecoveryCard">
          <ErrorRecoveryCard
            message="I couldn't save the floor details. This might be a temporary issue."
            actions={[
              { label: "Try again", action: "Please try saving again" },
              {
                label: "Show what's saved",
                action: "What do you have saved so far?",
              },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            B. STAGE 1 — INTRO (3 components)
           ============================================================ */}
        <SectionHeader label="B. Stage 1 — Intro" count={3} />

        <ShowcaseItem name="WelcomeHero">
          <WelcomeHero />
        </ShowcaseItem>

        <ShowcaseItem name="PropertyTypeSelector">
          <PropertyTypeSelector onSendMessage={mockSend} />
        </ShowcaseItem>

        <ShowcaseItem name="IntroSummaryCard">
          <IntroSummaryCard
            user_name="Sanchay"
            property_name="Sunrise PG"
            property_type="pg"
            property_location="Koramangala, Bangalore"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            C. STAGE 2 — STRUCTURE (5 components)
           ============================================================ */}
        <SectionHeader label="C. Stage 2 — Structure" count={5} />

        <ShowcaseItem name="FloorBuilder">
          <FloorBuilder
            floors={[
              {
                index: 0,
                label: "Ground Floor",
                active: true,
                unitCount: 5,
                nameRange: "001-005",
              },
              {
                index: 1,
                label: "1st Floor",
                active: true,
                unitCount: 6,
                nameRange: "101-106",
              },
              {
                index: 2,
                label: "2nd Floor",
                active: true,
                unitCount: 4,
                nameRange: "201-204",
              },
            ]}
            highlightFloor={1}
          />
        </ShowcaseItem>

        <ShowcaseItem name="UnitCountInput">
          <UnitCountInput
            floorLabel="Ground Floor"
            currentCount={5}
            suggestedRange={[4, 8]}
            hint="Most PGs in Koramangala have 4-8 rooms per floor"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="NamingPreview">
          <NamingPreview
            patternDescription="Floor prefix + sequential number (e.g. 001, 101, 201)"
            preview={[
              {
                floor: "Ground Floor",
                names: ["001", "002", "003", "004", "005"],
              },
              {
                floor: "1st Floor",
                names: ["101", "102", "103", "104", "105", "106"],
              },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="FloorMilestoneReceipt">
          <FloorMilestoneReceipt
            floorLabel="Ground Floor"
            unitCount={5}
            nameRange="001-005"
          />
        </ShowcaseItem>

        <ShowcaseItem name="StructureSummaryCard">
          <StructureSummaryCard
            propertyName="Sunrise PG"
            totalFloors={3}
            totalUnits={15}
            floors={[
              { label: "Ground Floor", unitCount: 5, nameRange: "001-005" },
              { label: "1st Floor", unitCount: 6, nameRange: "101-106" },
              { label: "2nd Floor", unitCount: 4, nameRange: "201-204" },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            D. STAGE 3 — PACKAGES (4 components)
           ============================================================ */}
        <SectionHeader label="D. Stage 3 — Packages" count={4} />

        <ShowcaseItem name="PackageSuggestionCard">
          <PackageSuggestionCard
            suggestions={[
              {
                name: "AC Private Room",
                sharingType: "Single Occupancy",
                ac: true,
                estimatedRent: "~12,000/mo",
              },
              {
                name: "Non-AC Private Room",
                sharingType: "Single Occupancy",
                ac: false,
                estimatedRent: "~8,500/mo",
              },
            ]}
            location="Koramangala"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="PackageForm">
          <PackageForm
            name="AC Double Sharing"
            prefill={{
              ac: true,
              food: "included",
              furnishing: "fully_furnished",
              rent: 8500,
            }}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="PackageReceipt">
          <PackageReceipt
            name="AC Private Room"
            rent={12000}
            ac={true}
            food="Food Included"
            furnishing="fully_furnished"
          />
        </ShowcaseItem>

        <ShowcaseItem name="PackageList">
          <PackageList
            packages={[
              {
                id: "pkg-1",
                name: "AC Private Room",
                category: "single",
                sharing_type: "Single Occupancy",
                furnishing: "fully_furnished",
                amenities: ["AC", "WiFi", "Attached Bathroom"],
                food_included: true,
                starting_rent: 12000,
                active: true,
              },
              {
                id: "pkg-2",
                name: "Non-AC Private Room",
                category: "single",
                sharing_type: "Single Occupancy",
                furnishing: "semi_furnished",
                amenities: ["WiFi"],
                food_included: false,
                food_optional: true,
                starting_rent: 8500,
                active: true,
              },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            E. STAGE 4 — MAPPING (5 components)
           ============================================================ */}
        <SectionHeader label="E. Stage 4 — Mapping" count={5} />

        <ShowcaseItem name="MappingSuggestionCard">
          <MappingSuggestionCard
            suggestions={[
              {
                floorLabel: "Ground Floor",
                floorIndex: 0,
                packageName: "Non-AC Private Room",
                unitCount: 5,
              },
              {
                floorLabel: "1st Floor",
                floorIndex: 1,
                packageName: "AC Private Room",
                unitCount: 6,
              },
              {
                floorLabel: "2nd Floor",
                floorIndex: 2,
                packageName: "AC Private Room",
                unitCount: 4,
              },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="FloorMappingRow">
          <FloorMappingRow
            floorLabel="Ground Floor"
            floorIndex={0}
            units={[
              { id: "u1", name: "001", packageId: "pkg-2", packageName: "Non-AC Private Room" },
              { id: "u2", name: "002", packageId: "pkg-2", packageName: "Non-AC Private Room" },
              { id: "u3", name: "003", packageId: "pkg-2", packageName: "Non-AC Private Room" },
              { id: "u4", name: "004" },
              { id: "u5", name: "005" },
            ]}
            packages={[
              { id: "pkg-1", name: "AC Private Room" },
              { id: "pkg-2", name: "Non-AC Private Room" },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="MappingMatrix">
          <MappingMatrix
            floors={[
              { index: 0, label: "Ground Floor" },
              { index: 1, label: "1st Floor" },
              { index: 2, label: "2nd Floor" },
            ]}
            packages={[
              { id: "pkg-1", name: "AC Private" },
              { id: "pkg-2", name: "Non-AC Private" },
            ]}
            mapping={{
              0: { "pkg-2": 5 },
              1: { "pkg-1": 6 },
              2: { "pkg-1": 4 },
            }}
            floorTotals={{ 0: 5, 1: 6, 2: 4 }}
          />
        </ShowcaseItem>

        <ShowcaseItem name="BulkMappingPreview">
          <BulkMappingPreview
            description="Assign all rooms based on your floor preferences"
            operations={[
              {
                floorLabel: "Ground Floor",
                unitCount: 5,
                packageName: "Non-AC Private Room",
              },
              {
                floorLabel: "1st Floor",
                unitCount: 6,
                packageName: "AC Private Room",
              },
              {
                floorLabel: "2nd Floor",
                unitCount: 4,
                packageName: "AC Private Room",
              },
            ]}
            totalUnits={15}
            totalFloors={3}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="UnmappedUnitsWarning">
          <UnmappedUnitsWarning
            floors={[
              {
                floorLabel: "2nd Floor",
                floorIndex: 2,
                unitNames: ["203", "204"],
              },
            ]}
            totalUnmapped={2}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            F. STAGE 5 — VERIFICATION (3 components)
           ============================================================ */}
        <SectionHeader label="F. Stage 5 — Verification" count={3} />

        <ShowcaseItem name="VerificationSummary">
          <VerificationSummary
            property={{
              propertyName: "Sunrise PG",
              propertyType: "PG / Paying Guest",
              location: "Koramangala, Bangalore",
              ownerName: "Sanchay",
            }}
            floors={[
              { label: "Ground Floor", unitCount: 5, nameRange: "001-005" },
              { label: "1st Floor", unitCount: 6, nameRange: "101-106" },
              { label: "2nd Floor", unitCount: 4, nameRange: "201-204" },
            ]}
            packages={[
              {
                name: "AC Private Room",
                rent: 12000,
                ac: true,
                attributes: ["Fully Furnished", "Food Included"],
              },
              {
                name: "Non-AC Private Room",
                rent: 8500,
                ac: false,
                attributes: ["Semi Furnished"],
              },
            ]}
            mappings={[
              {
                floorLabel: "Ground Floor",
                packageName: "Non-AC Private Room",
                count: 5,
              },
              {
                floorLabel: "1st Floor",
                packageName: "AC Private Room",
                count: 6,
              },
              {
                floorLabel: "2nd Floor",
                packageName: "AC Private Room",
                count: 4,
              },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="PendingItemsList">
          <PendingItemsList
            items={[
              {
                id: "p1",
                description: "2 rooms on 2nd Floor have no package assigned",
                stage: "mapping",
                fixAction: "Help me assign packages to rooms 203 and 204",
              },
              {
                id: "p2",
                description: "Non-AC Private Room has no rent specified",
                stage: "packages",
                fixAction:
                  "Set rent for Non-AC Private Room package",
              },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="CompletionCelebration">
          <CompletionCelebration
            stats={{
              propertyName: "Sunrise PG",
              totalFloors: 3,
              totalRooms: 15,
              totalPackages: 2,
              propertyType: "PG",
              location: "Koramangala, Bangalore",
            }}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div
          key={toastKey}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[440px] w-[90%] px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4"
        >
          <p className="text-[10px] text-zinc-500 font-mono mb-0.5">
            onSendMessage:
          </p>
          <p className="text-xs text-zinc-200 break-words">{toast}</p>
        </div>
      )}
    </div>
  );
}

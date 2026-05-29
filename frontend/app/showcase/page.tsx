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
      <p className="text-[10px] text-content-tertiary font-mono mb-1 px-1">{name}</p>
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
    <div className="pt-8 pb-3 border-b border-border mb-4">
      <h2 className="text-[11px] font-semibold text-content-tertiary uppercase tracking-widest">
        {label}
        <span className="text-content-tertiary ml-2 font-normal">({count})</span>
      </h2>
    </div>
  );
}

// Scale badge
function ScaleBadge({ scale }: { scale: "S" | "M" | "L" }) {
  const colors = {
    S: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    M: "bg-accent/15 text-accent-light border-accent/20",
    L: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  };
  const labels = { S: "Small", M: "Medium", L: "Large" };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ml-2 ${colors[scale]}`}>
      {labels[scale]}
    </span>
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
    <div className="min-h-screen bg-bg-deep text-content">
      {/* Page header */}
      <div className="max-w-[480px] mx-auto px-4 pt-8 pb-4">
        <h1 className="text-lg font-bold text-content mb-1">
          Component Showcase
        </h1>
        <p className="text-xs text-content-tertiary mb-1">
          All 25 registered UI components rendered at multiple scales.
          Components adapt their interaction patterns based on data volume.
        </p>
        <div className="flex gap-2 mt-2">
          <ScaleBadge scale="S" />
          <span className="text-[10px] text-content-tertiary">1 floor, 3 rooms</span>
          <ScaleBadge scale="M" />
          <span className="text-[10px] text-content-tertiary">3 floors, 15 rooms</span>
          <ScaleBadge scale="L" />
          <span className="text-[10px] text-content-tertiary">8 floors, 40+ rooms</span>
        </div>
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
            gender_preference="male"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            C. STAGE 2 — STRUCTURE (5 components)
           ============================================================ */}
        <SectionHeader label="C. Stage 2 — Structure" count={5} />

        {/* ── FloorBuilder ── */}
        <ShowcaseItem name={`FloorBuilder`}>
          <ScaleBadge scale="M" />
          <div className="mt-1" />
          <FloorBuilder
            floors={[
              { index: 0, label: "Ground Floor", active: true, unitCount: 5, nameRange: "001-005" },
              { index: 1, label: "1st Floor", active: true, unitCount: 6, nameRange: "101-106" },
              { index: 2, label: "2nd Floor", active: true, unitCount: 4, nameRange: "201-204" },
            ]}
            highlightFloor={1}
          />
        </ShowcaseItem>

        <ShowcaseItem name={`FloorBuilder (12 floors — sandwich display)`}>
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <FloorBuilder
            floors={[
              { index: 0, label: "Ground Floor", active: true, unitCount: 6, unitBreakdown: [{ category: "pg_room", label: "Rooms", count: 4 }, { category: "studio", label: "Studios", count: 2 }] },
              { index: 1, label: "1st Floor", active: true, unitCount: 8 },
              { index: 2, label: "2nd Floor", active: true, unitCount: 8 },
              { index: 3, label: "3rd Floor", active: true, unitCount: 8 },
              { index: 4, label: "4th Floor", active: true, unitCount: 8 },
              { index: 5, label: "5th Floor", active: true, unitCount: 8 },
              { index: 6, label: "6th Floor", active: true, unitCount: 6 },
              { index: 7, label: "7th Floor", active: true, unitCount: 6 },
              { index: 8, label: "8th Floor", active: true, unitCount: 5 },
              { index: 9, label: "9th Floor", active: true, unitCount: 5 },
              { index: 10, label: "10th Floor", active: true, unitCount: 4 },
              { index: 11, label: "Terrace Floor", active: true, unitCount: 2, unitBreakdown: [{ category: "studio", label: "Studios", count: 2 }] },
            ]}
            highlightFloor={3}
          />
        </ShowcaseItem>

        {/* ── UnitCountInput ── */}
        <ShowcaseItem name="UnitCountInput (single floor)">
          <ScaleBadge scale="S" />
          <div className="mt-1" />
          <UnitCountInput
            floorLabel="Ground Floor"
            currentCount={5}
            suggestedRange={[4, 8]}
            hint="Most PGs in Koramangala have 4-8 rooms per floor"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="UnitCountInput (multi-floor batch)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <UnitCountInput
            floorLabel="Ground Floor"
            floors={[
              { index: 0, label: "Ground Floor", suggestedRange: [4, 8] as [number, number] },
              { index: 1, label: "1st Floor", suggestedRange: [6, 10] as [number, number] },
              { index: 2, label: "2nd Floor", suggestedRange: [6, 10] as [number, number] },
              { index: 3, label: "3rd Floor", suggestedRange: [6, 10] as [number, number] },
              { index: 4, label: "4th Floor", suggestedRange: [4, 8] as [number, number] },
            ]}
            hint="Set room counts for all floors"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="UnitCountInput (mixed unit types)">
          <UnitCountInput
            floorLabel="1st Floor"
            unitTypes={[
              { category: "pg_room", label: "Rooms", count: 6 },
              { category: "studio", label: "Studios", count: 2 },
              { category: "hostel_dorm", label: "Dorm Beds", count: 4 },
            ]}
            hint="This floor has a mix of rooms, studios, and dorm beds"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ── NamingPreview ── */}
        <ShowcaseItem name="NamingPreview (2 floors — inline)">
          <ScaleBadge scale="S" />
          <div className="mt-1" />
          <NamingPreview
            patternDescription="Floor prefix + sequential number (e.g. 001, 101, 201)"
            preview={[
              { floor: "Ground Floor", names: ["001", "002", "003", "004", "005"] },
              { floor: "1st Floor", names: ["101", "102", "103", "104", "105", "106"] },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="NamingPreview (5 floors — FloorChipBar tabbed)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <NamingPreview
            patternDescription="Type prefix + floor + number"
            preview={[
              {
                floor: "Ground Floor", names: [],
                units: [
                  { name: "R-001", category: "pg_room" }, { name: "R-002", category: "pg_room" },
                  { name: "R-003", category: "pg_room" }, { name: "R-004", category: "pg_room" },
                  { name: "S-001", category: "studio" }, { name: "S-002", category: "studio" },
                ],
              },
              {
                floor: "1st Floor", names: [],
                units: [
                  { name: "R-101", category: "pg_room" }, { name: "R-102", category: "pg_room" },
                  { name: "R-103", category: "pg_room" }, { name: "R-104", category: "pg_room" },
                  { name: "R-105", category: "pg_room" }, { name: "R-106", category: "pg_room" },
                  { name: "S-101", category: "studio" }, { name: "S-102", category: "studio" },
                ],
              },
              {
                floor: "2nd Floor", names: [],
                units: [
                  { name: "R-201", category: "pg_room" }, { name: "R-202", category: "pg_room" },
                  { name: "R-203", category: "pg_room" }, { name: "R-204", category: "pg_room" },
                  { name: "R-205", category: "pg_room" }, { name: "R-206", category: "pg_room" },
                  { name: "R-207", category: "pg_room" }, { name: "R-208", category: "pg_room" },
                ],
              },
              {
                floor: "3rd Floor", names: [],
                units: [
                  { name: "R-301", category: "pg_room" }, { name: "R-302", category: "pg_room" },
                  { name: "R-303", category: "pg_room" }, { name: "R-304", category: "pg_room" },
                  { name: "D-301", category: "hostel_dorm" }, { name: "D-302", category: "hostel_dorm" },
                  { name: "D-303", category: "hostel_dorm" }, { name: "D-304", category: "hostel_dorm" },
                ],
              },
              {
                floor: "4th Floor", names: ["401", "402", "403", "404", "405", "406"],
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

        {/* ── StructureSummaryCard ── */}
        <ShowcaseItem name="StructureSummaryCard (3 floors — inline)">
          <ScaleBadge scale="M" />
          <div className="mt-1" />
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

        <ShowcaseItem name="StructureSummaryCard (8 floors — collapsible + grouped)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <StructureSummaryCard
            propertyName="Grand Residency"
            totalFloors={8}
            totalUnits={52}
            floors={[
              { label: "Ground Floor", unitCount: 6, nameRange: "G01-G06", unitBreakdown: [{ category: "pg_room", label: "Rooms", count: 4 }, { category: "studio", label: "Studios", count: 2 }] },
              { label: "1st Floor", unitCount: 8, nameRange: "101-108" },
              { label: "2nd Floor", unitCount: 8, nameRange: "201-208" },
              { label: "3rd Floor", unitCount: 8, nameRange: "301-308" },
              { label: "4th Floor", unitCount: 8, nameRange: "401-408" },
              { label: "5th Floor", unitCount: 6, nameRange: "501-506" },
              { label: "6th Floor", unitCount: 6, nameRange: "601-606" },
              { label: "Terrace Floor", unitCount: 2, nameRange: "T01-T02", unitBreakdown: [{ category: "studio", label: "Studios", count: 2 }] },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            D. STAGE 3 — PACKAGES (4 components)
           ============================================================ */}
        <SectionHeader label="D. Stage 3 — Packages" count={4} />

        <ShowcaseItem name="PackageSuggestionCard (2 packages — flat)">
          <ScaleBadge scale="S" />
          <div className="mt-1" />
          <PackageSuggestionCard
            suggestions={[
              { name: "AC Private Room", sharingType: "private", ac: true, estimatedRent: "~12,000/mo", category: "pg_room" },
              { name: "Non-AC Double Sharing", sharingType: "double", ac: false, estimatedRent: "~6,000/mo", category: "pg_room" },
            ]}
            location="Koramangala"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="PackageSuggestionCard (5 packages — card stack)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <PackageSuggestionCard
            suggestions={[
              { name: "AC Private Room", sharingType: "private", ac: true, estimatedRent: "~12,000/mo", category: "pg_room" },
              { name: "AC Double Sharing", sharingType: "double", ac: true, estimatedRent: "~7,500/mo", category: "pg_room" },
              { name: "Non-AC Triple Sharing", sharingType: "triple", ac: false, estimatedRent: "~5,000/mo", category: "pg_room" },
              { name: "Studio Apartment", sharingType: "private", ac: true, estimatedRent: "~18,000/mo", category: "studio" },
              { name: "Dorm Bed", sharingType: "dormitory", ac: false, estimatedRent: "~3,500/mo", category: "hostel_dorm" },
            ]}
            location="HSR Layout"
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="PackageForm (multi-create flow)">
          <PackageForm
            name="AC Double Sharing"
            prefill={{
              ac: true,
              food: "included",
              furnishing: "fully_furnished",
              rent: 7500,
              sharingType: "double",
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
            security_deposit={12000}
            lock_in_period={3}
            notice_period={30}
          />
        </ShowcaseItem>

        <ShowcaseItem name="PackageList (3 packages — flat)">
          <ScaleBadge scale="S" />
          <div className="mt-1" />
          <PackageList
            packages={[
              { id: "pkg-1", name: "AC Private Room", category: "pg_room", sharing_type: "private", amenities: ["AC"], food_included: true, starting_rent: 12000, active: true },
              { id: "pkg-2", name: "AC Double Sharing", category: "pg_room", sharing_type: "double", amenities: ["AC"], food_included: true, starting_rent: 7500, active: true },
              { id: "pkg-3", name: "Non-AC Triple", category: "pg_room", sharing_type: "triple", amenities: [], starting_rent: 5000, active: true },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="PackageList (6 packages — accordion groups)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <PackageList
            packages={[
              { id: "pkg-1", name: "AC Private Room", category: "pg_room", sharing_type: "private", furnishing: "fully_furnished", amenities: ["AC", "WiFi", "Attached Bathroom"], food_included: true, starting_rent: 12000, active: true },
              { id: "pkg-2", name: "Non-AC Private Room", category: "pg_room", sharing_type: "private", furnishing: "semi_furnished", amenities: ["WiFi"], food_optional: true, starting_rent: 8500, active: true },
              { id: "pkg-3", name: "AC Double Sharing", category: "pg_room", sharing_type: "double", furnishing: "fully_furnished", amenities: ["AC", "WiFi"], food_included: true, starting_rent: 7500, active: true },
              { id: "pkg-4", name: "Non-AC Triple Sharing", category: "pg_room", sharing_type: "triple", furnishing: "semi_furnished", amenities: ["WiFi"], food_included: true, starting_rent: 5000, active: true },
              { id: "pkg-5", name: "Studio Apartment", category: "studio", sharing_type: "private", furnishing: "fully_furnished", amenities: ["AC", "WiFi", "Kitchen"], starting_rent: 18000, active: true },
              { id: "pkg-6", name: "Dorm Bed", category: "hostel_dorm", sharing_type: "dormitory", furnishing: "semi_furnished", amenities: ["WiFi"], food_included: true, starting_rent: 3500, active: true },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            E. STAGE 4 — MAPPING (5 components)
           ============================================================ */}
        <SectionHeader label="E. Stage 4 — Mapping" count={5} />

        {/* ── MappingSuggestionCard ── */}
        <ShowcaseItem name="MappingSuggestionCard (2 floors — flat)">
          <ScaleBadge scale="S" />
          <div className="mt-1" />
          <MappingSuggestionCard
            suggestions={[
              { floorLabel: "Ground Floor", floorIndex: 0, packageName: "AC Private Room", unitCount: 5 },
              { floorLabel: "1st Floor", floorIndex: 1, packageName: "AC Double Sharing", unitCount: 6 },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="MappingSuggestionCard (5 floors — floor-by-floor review)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <MappingSuggestionCard
            suggestions={[
              { floorLabel: "Ground Floor", floorIndex: 0, assignments: [{ packageName: "AC Private Room", unitCount: 4 }, { packageName: "Studio Apartment", unitCount: 2 }] },
              { floorLabel: "1st Floor", floorIndex: 1, assignments: [{ packageName: "AC Double Sharing", unitCount: 4 }, { packageName: "Non-AC Triple", unitCount: 2 }, { packageName: "Dorm Bed", unitCount: 2 }] },
              { floorLabel: "2nd Floor", floorIndex: 2, packageName: "AC Double Sharing", unitCount: 8 },
              { floorLabel: "3rd Floor", floorIndex: 3, assignments: [{ packageName: "AC Private Room", unitCount: 4 }, { packageName: "Non-AC Triple", unitCount: 4 }] },
              { floorLabel: "4th Floor", floorIndex: 4, packageName: "AC Private Room", unitCount: 6 },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ── FloorMappingRow ── */}
        <ShowcaseItem name="FloorMappingRow (10 units — inline multi-select)">
          <ScaleBadge scale="M" />
          <div className="mt-1" />
          <FloorMappingRow
            floorLabel="1st Floor"
            floorIndex={1}
            units={[
              { id: "u1", name: "R-101", category: "pg_room", packageId: "pkg-3", packageName: "AC Double Sharing" },
              { id: "u2", name: "R-102", category: "pg_room", packageId: "pkg-3", packageName: "AC Double Sharing" },
              { id: "u3", name: "R-103", category: "pg_room", packageId: "pkg-4", packageName: "Non-AC Triple" },
              { id: "u4", name: "R-104", category: "pg_room" },
              { id: "u5", name: "R-105", category: "pg_room" },
              { id: "u6", name: "R-106", category: "pg_room" },
              { id: "u7", name: "S-101", category: "studio", packageId: "pkg-5", packageName: "Studio Apt" },
              { id: "u8", name: "S-102", category: "studio" },
              { id: "u9", name: "D-101", category: "hostel_dorm" },
              { id: "u10", name: "D-102", category: "hostel_dorm" },
            ]}
            packages={[
              { id: "pkg-1", name: "AC Private Room" },
              { id: "pkg-3", name: "AC Double Sharing" },
              { id: "pkg-4", name: "Non-AC Triple" },
              { id: "pkg-5", name: "Studio Apt" },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="FloorMappingRow (25 units — collapsed + BottomSheet)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <FloorMappingRow
            floorLabel="2nd Floor"
            floorIndex={2}
            units={Array.from({ length: 25 }, (_, i) => ({
              id: `lg-${i}`,
              name: `R-${200 + i + 1}`,
              category: i < 18 ? "pg_room" : i < 22 ? "studio" : "hostel_dorm",
              ...(i < 10 ? { packageId: "pkg-3", packageName: "AC Double" } : {}),
            }))}
            packages={[
              { id: "pkg-1", name: "AC Private" },
              { id: "pkg-3", name: "AC Double" },
              { id: "pkg-4", name: "Non-AC Triple" },
              { id: "pkg-5", name: "Studio Apt" },
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
              { id: "pkg-3", name: "AC Double" },
              { id: "pkg-4", name: "Non-AC Triple" },
              { id: "pkg-5", name: "Studio" },
            ]}
            mapping={{
              0: { "pkg-1": 3, "pkg-5": 3 },
              1: { "pkg-3": 4, "pkg-4": 2, "pkg-5": 2 },
              2: { "pkg-1": 6 },
            }}
            floorTotals={{ 0: 8, 1: 10, 2: 6 }}
          />
        </ShowcaseItem>

        {/* ── BulkMappingPreview ── */}
        <ShowcaseItem name="BulkMappingPreview (3 rows — flat)">
          <ScaleBadge scale="S" />
          <div className="mt-1" />
          <BulkMappingPreview
            description="Assign all rooms to AC Private"
            operations={[
              { floorLabel: "Ground Floor", unitCount: 5, packageName: "AC Private Room" },
              { floorLabel: "1st Floor", unitCount: 6, packageName: "AC Private Room" },
            ]}
            totalUnits={11}
            totalFloors={2}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="BulkMappingPreview (7 assignment rows — package-grouped accordion)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <BulkMappingPreview
            description="Assign rooms across 5 floors based on your preferences"
            operations={[
              { floorLabel: "Ground Floor", assignments: [{ packageName: "AC Private Room", unitCount: 4 }, { packageName: "Studio Apartment", unitCount: 2 }] },
              { floorLabel: "1st Floor", assignments: [{ packageName: "AC Double Sharing", unitCount: 4 }, { packageName: "Dorm Bed", unitCount: 4 }] },
              { floorLabel: "2nd Floor", assignments: [{ packageName: "AC Double Sharing", unitCount: 5 }, { packageName: "Non-AC Triple", unitCount: 3 }] },
              { floorLabel: "3rd Floor", assignments: [{ packageName: "AC Private Room", unitCount: 4 }, { packageName: "Non-AC Triple", unitCount: 4 }] },
              { floorLabel: "4th Floor", packageName: "AC Private Room", unitCount: 6 },
            ]}
            totalUnits={36}
            totalFloors={5}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ── UnmappedUnitsWarning ── */}
        <ShowcaseItem name="UnmappedUnitsWarning (6 units — inline)">
          <ScaleBadge scale="S" />
          <div className="mt-1" />
          <UnmappedUnitsWarning
            floors={[
              {
                floorLabel: "1st Floor", floorIndex: 1, unitNames: [],
                units: [
                  { name: "R-104", category: "pg_room" },
                  { name: "R-105", category: "pg_room" },
                  { name: "R-106", category: "pg_room" },
                  { name: "S-102", category: "studio" },
                  { name: "D-101", category: "hostel_dorm" },
                  { name: "D-102", category: "hostel_dorm" },
                ],
              },
            ]}
            totalUnmapped={6}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="UnmappedUnitsWarning (15 units — aggregate + BottomSheet)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <UnmappedUnitsWarning
            floors={[
              {
                floorLabel: "Ground Floor", floorIndex: 0, unitNames: [],
                units: [
                  { name: "G-003", category: "pg_room" }, { name: "G-004", category: "pg_room" },
                  { name: "S-002", category: "studio" },
                ],
              },
              {
                floorLabel: "1st Floor", floorIndex: 1, unitNames: [],
                units: [
                  { name: "R-104", category: "pg_room" }, { name: "R-105", category: "pg_room" },
                  { name: "R-106", category: "pg_room" }, { name: "S-102", category: "studio" },
                  { name: "D-101", category: "hostel_dorm" }, { name: "D-102", category: "hostel_dorm" },
                ],
              },
              {
                floorLabel: "3rd Floor", floorIndex: 3, unitNames: [],
                units: [
                  { name: "R-305", category: "pg_room" }, { name: "R-306", category: "pg_room" },
                  { name: "R-307", category: "pg_room" }, { name: "R-308", category: "pg_room" },
                ],
              },
              {
                floorLabel: "4th Floor", floorIndex: 4, unitNames: [],
                units: [
                  { name: "R-405", category: "pg_room" }, { name: "R-406", category: "pg_room" },
                ],
              },
            ]}
            totalUnmapped={15}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        {/* ============================================================
            F. STAGE 5 — VERIFICATION (3 components)
           ============================================================ */}
        <SectionHeader label="F. Stage 5 — Verification" count={3} />

        <ShowcaseItem name="VerificationSummary (accordion sections + pending)">
          <ScaleBadge scale="L" />
          <div className="mt-1" />
          <VerificationSummary
            property={{
              propertyName: "Grand Residency",
              propertyType: "Coliving Space",
              location: "HSR Layout, Bangalore",
              ownerName: "Sanchay",
            }}
            floors={[
              { label: "Ground Floor", unitCount: 6, nameRange: "G01-G06", unitBreakdown: [{ category: "pg_room", label: "Rooms", count: 4 }, { category: "studio", label: "Studios", count: 2 }] },
              { label: "1st Floor", unitCount: 8, nameRange: "101-108" },
              { label: "2nd Floor", unitCount: 8, nameRange: "201-208" },
              { label: "3rd Floor", unitCount: 8, nameRange: "301-308" },
              { label: "4th Floor", unitCount: 6, nameRange: "401-406" },
              { label: "5th Floor", unitCount: 6, nameRange: "501-506" },
              { label: "6th Floor", unitCount: 6, nameRange: "601-606" },
              { label: "Terrace", unitCount: 2, nameRange: "T01-T02", unitBreakdown: [{ category: "studio", label: "Studios", count: 2 }] },
            ]}
            packages={[
              { name: "AC Private Room", rent: 12000, ac: true, sharingType: "Private", attributes: ["Fully Furnished", "Food Included"] },
              { name: "Non-AC Private Room", rent: 8500, sharingType: "Private", attributes: ["Semi Furnished"] },
              { name: "AC Double Sharing", rent: 7500, ac: true, sharingType: "Double Sharing", attributes: ["Fully Furnished"] },
              { name: "Non-AC Triple Sharing", rent: 5000, sharingType: "Triple Sharing", attributes: ["Semi Furnished"] },
              { name: "Studio Apartment", rent: 18000, ac: true, sharingType: "Private", attributes: ["Kitchen", "Fully Furnished"] },
              { name: "Dorm Bed", rent: 3500, sharingType: "Dormitory", attributes: ["Semi Furnished"] },
            ]}
            mappings={[
              { floorLabel: "Ground Floor", assignments: [{ packageName: "AC Private Room", count: 4 }, { packageName: "Studio Apartment", count: 2 }] },
              { floorLabel: "1st Floor", assignments: [{ packageName: "AC Double Sharing", count: 4 }, { packageName: "Non-AC Triple", count: 2 }, { packageName: "Dorm Bed", count: 2 }] },
              { floorLabel: "2nd Floor", packageName: "AC Double Sharing", count: 8 },
              { floorLabel: "3rd Floor", assignments: [{ packageName: "AC Private Room", count: 4 }, { packageName: "Non-AC Triple", count: 4 }] },
              { floorLabel: "4th Floor", packageName: "AC Private Room", count: 6 },
              { floorLabel: "5th Floor", packageName: "Non-AC Private Room", count: 6 },
              { floorLabel: "6th Floor", packageName: "AC Double Sharing", count: 6 },
              { floorLabel: "Terrace", packageName: "Studio Apartment", count: 2 },
            ]}
            pending={[
              { description: "2 dorm beds on 1st Floor have no package assigned", severity: "error" },
              { description: "Non-AC Triple Sharing food option not configured", severity: "warning" },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="VerificationSummary (clean — no pending)">
          <ScaleBadge scale="M" />
          <div className="mt-1" />
          <VerificationSummary
            property={{
              propertyName: "Sunrise PG",
              propertyType: "PG / Paying Guest",
              location: "Koramangala, Bangalore",
              ownerName: "Sanchay",
              genderPreference: "male",
            }}
            floors={[
              { label: "Ground Floor", unitCount: 5, nameRange: "001-005" },
              { label: "1st Floor", unitCount: 6, nameRange: "101-106" },
              { label: "2nd Floor", unitCount: 4, nameRange: "201-204" },
            ]}
            packages={[
              { name: "AC Private Room", rent: 12000, sharingType: "Private", securityDeposit: 12000, lockIn: 3, notice: 30 },
              { name: "AC Double Sharing", rent: 7500, sharingType: "Double Sharing", securityDeposit: 7500, lockIn: 2, notice: 30 },
            ]}
            mappings={[
              { floorLabel: "Ground Floor", packageName: "AC Private Room", count: 5 },
              { floorLabel: "1st Floor", packageName: "AC Double Sharing", count: 6 },
              { floorLabel: "2nd Floor", packageName: "AC Private Room", count: 4 },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="PendingItemsList">
          <PendingItemsList
            items={[
              {
                id: "p1",
                description: "2 dorm beds on 1st Floor have no package assigned",
                stage: "mapping",
                fixAction: "Help me assign packages to dorm beds D-101 and D-102",
              },
              {
                id: "p2",
                description: "Non-AC Triple Sharing has no rent specified",
                stage: "packages",
                fixAction: "Set rent for Non-AC Triple Sharing package",
              },
            ]}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>

        <ShowcaseItem name="CompletionCelebration">
          <CompletionCelebration
            stats={{
              propertyName: "Grand Residency",
              totalFloors: 8,
              totalRooms: 50,
              totalPackages: 6,
              propertyType: "Coliving",
              location: "HSR Layout, Bangalore",
            }}
            onSendMessage={mockSend}
          />
        </ShowcaseItem>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div
          key={toastKey}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[440px] w-[90%] px-4 py-2.5 rounded-xl bg-bg-elevated border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4"
        >
          <p className="text-[10px] text-content-tertiary font-mono mb-0.5">
            onSendMessage:
          </p>
          <p className="text-xs text-content break-words">{toast}</p>
        </div>
      )}
    </div>
  );
}

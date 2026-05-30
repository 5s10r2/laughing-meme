# Living Blueprint — Component System & Heterogeneity Model

The generative-UI component system for the Tarini "Living Blueprint" redesign.
This document is the design contract. New Living Blueprint components live under
`app/components/blueprint/` (e.g. `MassingModel.tsx`, `FloorComposition.tsx`,
`tokens.ts`); the legacy dark-theme components remain under `app/components/stages/`
until they are redesigned onto the Living Blueprint primitives.

**Built so far:** the `.lp-theme` token layer, `MassingModel`, and the
`FloorComposition` keystone primitive. Everything else below is specced, not yet
implemented. The `/blueprint` storybook (dev-only) is where new components are
validated before the live chat shell is flipped to warm paper.

## Objective

Let a non-technical Indian rental operator **watch their property take shape as
they talk**, where every component is a faithful, glanceable, always-in-sync
projection of the AI-maintained domain model, and where arbitrary real-world
**heterogeneity** (multiple packages, unit types, and sharing types mixed across
a property, a floor, even a single room) is represented clearly and at the right
altitude — summarised by default, drillable on demand — on a mobile screen.

## Renderer decision (settled)

The massing model is **procedural SVG**, not three.js/R3F/Spline/CSS-3D. A
6-agent decision panel confirmed SVG for an inline-chat, low-end-Android,
data-driven widget: WebGL canvases black-box when re-emitted into a scroll;
Spline can't regenerate geometry from a runtime array; SVG is featherweight and
regenerates from data. Craft ceiling is the one axis this use case can concede —
a glanceable iso symbol needs no camera. The massing is a **shape portrait**, not
a per-floor control surface.

## The component set (storybook), by stage

| Stage | Component | Job | Status |
|---|---|---|---|
| — | **MassingModel** | Property as a glanceable isometric portrait (the hero) | built |
| — | State-machine chrome | sheen/glow/live-dot, error chip, idle placeholder | built |
| Structure | **FloorLedger / FloorTray** | Per-floor rows: composition bar + tap-to-expand room cells | deferred |
| Structure | **BlockTabs** | Switch between blocks (1–4) | deferred |
| Packages | **PackageList** | The property's distinct packages, each a card | redesign pending |
| Packages | **PackageSuggestionCard / PackageForm / PackageReceipt** | Propose / edit / confirm a package | redesign pending |
| Mapping | **MappingMatrix** | Floor × package grid — the heterogeneity view | redesign pending |
| Mapping | **FloorMappingRow / BulkMappingPreview / UnmappedUnitsWarning** | Assign rooms→packages, bulk apply, flag gaps | redesign pending |
| Verify | **VerificationSummary** | The whole reconciled property before go-live | redesign pending |

## The massing state machine (built)

`idle → generating → updating → settled`, plus `error`. Each state owns its
motion:

- **idle** — faint placeholder, no building yet.
- **generating** — first build: floors rise once (staggered) + sheen/glow/pulse.
- **updating** — an existing building changes: it stays put (no full replay)
  while sheen/glow signal work; only changed floors animate.
- **settled** — fully static, calm.
- **error** — calm failure (SSE drop / invalid structure): building desaturates,
  a quiet amber "TAP TO RETRY" chip (never alarming red).

Per-floor motion is framer-motion `AnimatePresence` + springs. Floors carry
**stable ground-relative ids**, so adding a floor mounts only the new one while
the rest spring to their new positions — velocity-preserving and interruptible.
A removed floor exit-animates **within a stable build**; re-entering `generating`
remounts the set (via an epoch bump) to replay the full staggered entrance.
`prefers-reduced-motion` collapses all movement. Inputs are coerced defensively
(finite, clamped floor counts) since props arrive loosely-typed from the LLM.

## Heterogeneity is a data fact, not a UI special case

All heterogeneity lives at the **unit level** in the Phase A schema:

```
unit    = { id, name, floor_index, category, sharing_type, package_id, active }
package = { id, name, category, sharing_type, furnishing, amenities, food, starting_rent }
```

Each real-world scenario is a query over that one array:

| Scenario | In the data | Component that surfaces it | How it's shown |
|---|---|---|---|
| Different packages in one property | `packages[]` has N entries | **PackageList** | N distinct package cards |
| Different unit types in one property | units vary in `category`/`sharing_type` | MassingModel counts + FloorLedger legend | type legend + per-floor composition + "Types: N" stat |
| Different sharing types in one floor | same `floor_index`, different `sharing_type` | **FloorTray composition bar** | one proportional bar split by type colour + coloured room cells on expand |
| Different packages in one floor | same `floor_index`, different `package_id` | **MappingMatrix** + FloorTray re-skinned | matrix cell counts ("Floor 2: 4× AC Single, 2× Non-AC Double") |

### The one primitive that carries it: the composition bar

A proportional, colour-segmented bar over a floor's units. In the **structure**
stage it's coloured by sharing/type; in the **mapping** stage the *same bar
re-skins* to colour by package. Room cells (8 + "+N" grid) are the tap-to-expand
drill-down, each cell coloured by its type or package. The MassingModel stays a
shape portrait — it does NOT paint per-unit packages onto the building (that's a
barcode in disguise); heterogeneity lives in the ledger and the matrix.

## How components come up and become visible — progressive disclosure

The AI emits components **per stage**, so heterogeneity is revealed in absorbable
order:

- **Structure** → MassingModel + FloorLedger (per-floor type mix)
- **Packages** → PackageList (the distinct packages become concrete)
- **Mapping** → MappingMatrix (floor × package — where "different packages in one
  floor" becomes explicit and assignable)
- **Verify** → VerificationSummary (the whole heterogeneous picture reconciled)

Scale-resilience keeps mixed data legible at every step: composition bars
summarise, tap-to-expand reveals cells, the matrix groups, long lists collapse
with "+N", the massing compresses tall buildings. Every component has a summary
form and a drill-down form, so heterogeneity never becomes clutter.

## How it stays in sync with the AI (the guarantee)

Components are a **pure projection of one domain aggregate**: `UI = f(state)`. The
AI never draws UI; it mutates the model only through typed commands.

```
operator speaks
  → Claude issues TYPED COMMANDS (Phase A apply_commands: set_floor, add_package,
                                   set_unit_category, map_units_to_package, …)
  → CommandService applies them to the Property AGGREGATE  (single source of truth)
  → ui_adapter PROJECTS the current aggregate → component props
  → emit_ui(componentName, props) over SSE
  → component renders → state=updating animates the delta
```

Because there is exactly one source of truth and the AI mutates it only via
commands, the heterogeneity the AI creates is — by construction — the
heterogeneity the UI shows. `ui_adapter`'s per-floor `mix` and floor×package
matrix aggregation is the seam that turns unit-level heterogeneity into the
composition/matrix props the components consume.

## Build order to realize this

1. **FloorLedger / FloorTray** — the composition-bar primitive (carries most
   heterogeneity).
2. **MappingMatrix** — the floor × package view.
3. **`ui_adapter` aggregation** — `mix` (per-floor type histogram) and the
   floor × package matrix that feed 1 and 2 from live CommandService data.
4. Redesign the package / mapping / verification components in the Living
   Blueprint language.
5. Multi-block layout (1–4 blocks) in the massing.
6. Design-token sweep (warm paper + indigo, drop Fraunces) across the chat shell.

## Dev harness

`app/massing-spike/page.tsx` (dev-only) drives every massing state, the floor
count, and per-floor deltas live. Not part of the product.

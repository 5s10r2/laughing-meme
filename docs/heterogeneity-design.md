# Tarini — Heterogeneous Inventory & Offerings (Design Plan)

> Status: **proposal for review** (2026-05-31). Decision: research-grounded plan before building.
> Decisions already taken with the owner: offerings get a **flexible attribute set**; edit layer is paused for this.

## 1. The problem (from a real session)

A real operator built **"Great Heights"** — a residential flat building in Gurgaon: 3 floors, units
named `001/101/201`, three "packages" (1 BHK ₹25k · 2 BHK ₹45k · Studio ₹20k, all `sharing: private`,
`ac: false`, `food: none`, `furnishing: None`). It went end-to-end to *publishable* — but every label
was PG-shaped: units called "rooms", BHK configs forced into "packages", PG-style `001/101` numbering,
card chips reading **"Private · Non-AC"** (noise for a flat), `furnishing` never gated, and **no beds**.

The model *bent* (good — the flexible spine held), but the vocabulary, attributes, defaults, and chips
are **PG-locked**, so any non-PG operator gets a workable-but-awkward, slightly-confusing experience.

**Key correction (owner input):** Indian operators *blend* models, often within one property — whole-flat
leases, **rooms rented inside a flat** (PG-in-a-flat), **serviced/furnished apartments with food +
housekeeping**, and bed-wise PG/co-living. So the answer is **not** "detect type → lock a model." It is:
keep the flexible spine, add **sensible defaults** per type, **adaptive vocabulary** — and **never limit**.

## 2. What the market actually does (platform research)

- **The standard inventory hierarchy is `Building → Floor → Room → Bed`.** PG/hostel/co-living PMS
  (ManagR, Crib, Roomindo, TrackMyPG) manage down to the **individual bed**, with vacant/occupied/
  maintenance status per bed.
- **Bed-wise vs room-wise pricing are "two completely different billing models"** (TrackMyPG). Most PGs
  and co-living price **per bed** in a sharing room — *this is our single biggest gap.*
- **Co-living (Stanza / Zolo):** ~**70,000 beds** under management; single/double/triple/quad sharing;
  fully furnished; meals, wifi, laundry, housekeeping bundled. Bed-level, services-bundled.
- **Serviced apartments:** BHK configs (Studio / 1 / 2 / 3 BHK), fully furnished, services (housekeeping,
  food/breakfast, linen, utilities, internet), priced **daily / weekly / monthly** with a **minimum stay**.
- **Shared flats / co-living-in-flat** (CoLive, Nestaway, FlatMate): **private rooms / single–double–
  triple sharing inside a flat**, individual leases, furnished. The **flat is the container**; rooms
  (and beds) are the rentable things inside it.

## 3. The core insight

Two things vary across operators — and our model fixes both:

1. **The rentable level** — what gets a *price* and a *tenant* — can be a **Flat**, a **Room**, or a **Bed**.
   - Whole-flat lease → rent the **flat**. PG room-wise → rent the **room**. PG/co-living → rent the **bed**.
     Rooms-in-a-flat → flat contains rooms (rent the rooms/beds). Serviced → rent the **unit** (with services).
2. **The offering attributes** — what defines & prices it — differ by model: PG {sharing, food, AC,
   furnishing, deposit, notice}; Flat {BHK/config, carpet area, furnishing, deposit, lock-in}; Serviced
   {BHK, services, min-stay, billing period}; Co-living {sharing, bundled services}.

So we need (a) an **optional, nested inventory** where the rentable level is variable, and (b) a
**flexible offering attribute set** (already decided).

## 4. Proposed model

### 4.1 Inventory — one typed recursive space tree (ARCHITECTURE — owner decision)

Not a fixed ladder of entity types. A **single recursive node** (`Space`) that nests by a validated
**containment grammar**. A "PG" and an "apartment building" are the *same tree at different depths* —
the building is the root, and how deep we nest + which level we sell is **how we map the operator**.

```
Property (root)
  └─ Block?   (tower / wing)
      └─ Floor?
          └─ Flat / Unit?
              └─ Room?
                  └─ Bed?      (materialised only for the rare per-bed case)
```

**The node**
```
Space {
  id            : str
  parent_id     : str | None         # None = the property root
  kind          : property | block | floor | flat | room | bed
  label         : str
  order         : int                # sibling ordering
  status        : active | unavailable
  # capacity (rooms/units that hold tenants):
  sharing       : single|double|triple|quad|dormitory | None   # rooms → implies bed count
  config        : rk|studio|1bhk|2bhk|3bhk|4bhk_plus | None     # flats/units
  capacity      : int | None         # tenants/beds; derived from sharing, explicit for dorms
  # selling:
  rentable      : bool               # is THIS the level the operator sells?
  offering_id   : str | None         # the priced offering mapped to this rentable node
}
```

**Containment grammar (validated, but flexible).** Give kinds a rank
`property(0) < block(1) < floor(2) < flat(3) < room(4) < bed(5)`. **A node may contain children only of
strictly higher rank** — so levels are freely *skippable* but never inverted:
- Simple PG: `property → room` (skip block/floor/flat). ✓
- PG with floors: `property → floor → room`. ✓ (today)
- Apartment building, room-wise: `property → floor → flat → room`. ✓
- Whole-flat building: `property → floor → flat` (flat is the leaf, rentable). ✓
- Deep/unusual: `property → block → floor → flat → room → bed`. ✓
- Invalid (rejected): a `floor` inside a `room`, a `room` directly holding a `flat`, etc.

This gives recursion's flexibility **with** data sanity — the grammar + the structured offering catalog
(§4.2 / Appendix A) keep everything typed and filterable.

**Rentable level + capacity.** Each property marks **which nodes are `rentable`** (the sell level — bed,
room, or flat); offerings attach there. **`sharing` on a room is its capacity** (single=1 … triple=3;
dorm = explicit `capacity`). **Beds are the capacity number, not entities** — materialised as child
nodes *only* for the rare per-bed-rent case (deferred from v1). Mixed properties are natural (some flats
sold whole, some room-wise → just the `rentable` flag differs per subtree).

**Why one node, not five entities:** one entity + **one uniform command set** (below) instead of five
parallel ones; arbitrary-but-validated depth; the operator's words map cleanly onto the tree; and the
massing / ledger / mapping projections all *derive* from one structure.

### 4.1a Uniform command set (replaces AddFloors / SetFloorRooms / RenameRoom / RenameFloor / RemoveFloor / SetRoomType / MapRooms)
- `AddSpaces(parent_id, kind, count | labels, sharing?, config?)` — add N children of a kind.
- `RenameSpace(id, label)` · `RemoveSpace(id)` (subtree) · `MoveSpace(id, new_parent_id)` (re-parent).
- `SetSharing(ids, sharing)` / `SetConfig(ids, config)` / `SetCapacity(ids, n)`.
- `MarkRentable(ids, rentable)` · `MarkUnavailable(ids)`.
- `CreateOffering / UpdateOffering / DisableOffering / DeleteOffering` (curated structured attrs).
- `MapOffering(node_ids, offering_id)` · `UnmapOffering(node_ids)` · `Publish`.

### 4.1b Migration
Today's `Property{floors[], rooms[], packages[]}` → a `Space` tree (`property → floor nodes → room nodes`)
+ offerings (from packages). A `from_dict` converts old snapshots; migration `0003` for the persisted
schema. **Existing PG sessions convert 1:1 and behave identically.**

### 4.2 Offering — curated, fully-structured attributes (decided)
- An offering = `name` + `price` + a **billing basis** (`per_bed` | `per_unit`) + a **billing period**
  (monthly default / weekly / daily) + a **curated, fully-structured attribute set** (no free text).
  Attaches to the rentable level (room/flat).
- **Everything is structured for data sanity (owner decision):** all categorical fields are enums and
  **amenities are a multi-select from a curated list — never free text** — so listings stay filterable
  ("2BHK under ₹40k with parking"), validated, and consistent. The catalog is **extensible in code**,
  but runtime values are always from the known set. Full catalog in **Appendix A**.
- **Billing basis resolves the rent ambiguity** (owner decision): a sharing PG room defaults to
  `per_bed` (so "₹6,000 triple" = ₹6,000 × 3 beds), a flat/serviced unit defaults to `per_unit`.
  Occupancy/availability can still be tracked per-bed downstream without per-bed *entities*.
- Attribute sets are **defaults, not limits** (operator can add/override):
  - **PG/Hostel:** sharing, food (none/included/optional), AC, furnishing, deposit, notice.
  - **Flat:** BHK/config, carpet area, furnishing, deposit, lock-in.
  - **Serviced:** BHK, services (food / housekeeping / linen / utilities), min-stay, billing period.
  - **Co-living:** sharing, bundled services.

### 4.3 Vocabulary & defaults
- **Infer → propose → confirm**, never lock: *"Flats — do you rent them whole, rooms inside them, or as
  serviced apartments?"* A default is a starting guess the operator overrides in one tap/word.
- **Adaptive labels:** units / flats / rooms / beds; "configurations" vs "packages".
- **Card chips by model** — stop showing "Private · Non-AC" on a flat; show BHK / furnishing / services instead.

## 5. Phased build (proposal) — re-architecture, so sequenced for safety

- **Phase A — The `Space` tree (domain core).** New recursive `Space` aggregate + containment grammar
  (rank rule), capacity/sharing/config, `rentable` marker. The uniform command set (§4.1a). Curated
  structured offerings (§4.2) + `billing_basis`/`billing_period`. Completeness re-derived from the tree.
  `from_dict` migration of today's `floors/rooms/packages` → tree. **Strict TDD, the riskiest phase.**
- **Phase A2 — Projections re-derive from the tree.** massing / floor-ledger / mapping / package-panel /
  unmapped / publish-checklist all walk the `Space` tree. Keep the existing component prop-shapes stable
  where possible so the frontend changes stay small.
- **Phase B — Prompt brain.** Model detection (propose-confirm: "whole flats / rooms inside them /
  serviced?") → builds the right tree shape + rentable level; per-bed vs per-unit via billing basis;
  serviced services; adaptive vocabulary + per-model attribute gating (furnishing gated for flats).
- **Phase C — UI surface.** Tree-aware blueprint (a flat that contains rooms; a whole-flat unit; a bed
  count), offering cards by model (no "Private · Non-AC" on a flat), adaptive labels/chips.
- **Phase D — Back-compat & migration.** Existing PG sessions convert 1:1 (property → floors → rooms,
  rentable = room/bed) and behave identically; persisted-schema migration `0003`; both experience flags
  stay default-dormant so `main` is safe throughout.

**Sequencing note:** this touches the domain that 184 tests + the live experience depend on. Phase A
lands behind tests with the old shape still convertible; nothing flips on `main` until the tree + its
projections are green and verified live.

## 6. Decisions

**Resolved (owner):**
1. ~~Bed-first vs Unit-first~~ → **Unit/Flat first.** Beds stay lightweight (count from sharing + billing
   basis; no per-bed entities; per-bed override deferred).
2. ~~Rent semantics~~ → **billing basis on the offering** (`per_bed` default for PG sharing, `per_unit`
   for flats/serviced). Beds in a room are homogeneous (the 90% case).
3. ~~v1 scope~~ → **Unit/Flat level + flexible offerings (attrs + billing basis + period); beds light.**

4. ~~Offering attribute shape~~ → **curated + fully structured, NO free text** (amenities too). Enums
   everywhere for data sanity / filtering; catalog extensible in code, runtime always from the known set.

**All decisions are now locked — ready to scope Phase A.**

## 7. Risks
- **Complexity creep** — nesting + flexible attrs could overwhelm a simple-PG operator. Mitigation: strong
  defaults; never surface beds/units/extra attributes unless the operator's model needs them.
- **Migration** of the existing model + live sessions.
- Keeping the **thin-prompt** philosophy while adding model-awareness (do it as compact playbook, not bloat).

## Appendix A — Offering attribute catalog (curated · fully structured)

All categorical fields are **enums**; amenities/services are **multi-select from a fixed list** (no free
text). Extensible in code; runtime always from the known set. Fields surface **by relevance to the model**.

**Universal (every offering)**
- `name` (str), `price` (int, ₹), `billing_basis` ∈ {`per_bed`, `per_unit`}, `billing_period` ∈ {`monthly`,
  `weekly`, `daily`}, `active` (bool).

**Configuration — exactly one, by model**
- Shared-living (PG / hostel / co-living): `sharing` ∈ {`single`, `double`, `triple`, `quad`, `five_plus`,
  `dormitory`}.
- Flat / serviced / rooms-in-a-flat: `config` ∈ {`rk`, `studio`, `1bhk`, `2bhk`, `3bhk`, `4bhk_plus`}.

**Comfort**
- `ac` (bool) · `furnishing` ∈ {`unfurnished`, `semi_furnished`, `fully_furnished`} ·
  `carpet_area_sqft` (int, optional — flats/serviced).

**Food & services**
- `food` ∈ {`none`, `included`, `optional`} ·
  `services` (multi ⊆ {`housekeeping`, `meals`, `linen`, `laundry`, `wifi`, `utilities`, `power_backup`,
  `security`}) — serviced / co-living.

**Tenancy terms**
- `deposit_months` (int) *or* `deposit_amount` (int) · `lock_in_months` (int) · `notice_days` (int) ·
  `min_stay` (int, with the billing period — serviced).

**Amenities** (multi ⊆ fixed list, **not free text**)
- {`wifi`, `ac`, `geyser`, `attached_bathroom`, `balcony`, `parking`, `lift`, `power_backup`, `cctv`,
  `washing_machine`, `refrigerator`, `tv`, `study_table`, `wardrobe`, `hot_water`, `drinking_water`,
  `daily_cleaning`, `gym`, `common_area`}.

**Relevance by model (defaults — operator can adjust, never locked)**

| Model | Config | Shown fields | Default billing basis |
| --- | --- | --- | --- |
| PG / Hostel | `sharing` | food, ac, furnishing, deposit, notice, amenities | `per_bed` |
| Co-living | `sharing` | services, furnishing, deposit, lock-in, notice, amenities | `per_bed` |
| Flat (whole) | `config` | carpet_area, furnishing, deposit, lock-in, notice, amenities | `per_unit` |
| Serviced apt | `config` | services, furnishing, min_stay, billing_period, amenities | `per_unit` |
| Rooms-in-a-flat | `sharing`/`config` per room | food, ac, furnishing, deposit, amenities | `per_bed` |

## Sources
- ManagR (PG/hostel/co-living PMS — Building→Floor→Room→Bed): https://managr.bedrindia.com/
- Crib (service apartments, student housing, PG; bed & room status): https://www.cribapp.com/
- TrackMyPG (room-wise **and** bed-wise pricing — two billing models): https://trackmypg.com/blog/pg-management-software-india-2026
- Roomindo (co-living/hostel/PG PMS): https://roomindo.com/
- Stanza Living vs Zolostays (70k beds; sharing tiers; bundled services): https://krishnakishore1.medium.com/comparing-the-2-biggest-paying-guest-businesses-stanza-living-vs-zolostays-f744cda90fff
- Serviced apartments India (BHK configs, services, min-stay, daily/weekly/monthly): https://www.squareyards.com/sale/guides/what-is-serviced-apartment
- Shared flats / rooms-in-a-flat (private/single/double/triple within flats): https://www.flatmate.in/ , https://www.colive.com/pg-in-bangalore/

# Living Blueprint — design prototypes (source of truth)

Static HTML prototypes for the Living Blueprint redesign. These were the design
source the React components are ported from. Banked here because they previously
lived only in `/tmp` and were lost once (recovered via session history).

Open any file directly in a browser, or serve the folder:
`python3 -m http.server 8899` then visit `http://localhost:8899/<file>`.

| File | What it is |
|---|---|
| `design-system.html` | **The complete design system / storybook** (≈109K): 6 foundations, 10 primitives, 4 chat atoms, massing + floor ledger, the 5 stages, edit patterns, rethought home IA, **§8 Resilience & edge cases**, **§9 Drill-down & states**. The canonical contract. |
| `living-blueprint-v4.html` | The animated massing-model prototype the React `MassingModel` was ported from (floor-by-floor draw, scales to many floors). |
| `massing-scale-compare.html` | This-session spike: barcode (literal) vs portrait massing at high floor counts, side by side. |

Implementation status and the design contract in prose: see
[`../../LIVING_BLUEPRINT.md`](../../LIVING_BLUEPRINT.md).
The shipped component lives at `app/components/blueprint/MassingModel.tsx`.

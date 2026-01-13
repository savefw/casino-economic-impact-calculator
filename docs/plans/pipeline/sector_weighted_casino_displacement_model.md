# Implementation Plan: Sector-Weighted Casino Displacement Model

## 1) Executive Summary

**Objective:** Improve the “Net Economic Impact” calculation by replacing a single flat displacement deduction with a **sector-specific** model that estimates **lost tax revenue** from displaced local spending.

**Core idea:**  
The “243 coefficient” (displacement) is applied only to **local** casino spending (not tourism/export dollars). The displaced amount is then allocated across **at-risk discretionary sectors** (Retail, Dining, Entertainment), and tax impacts are computed using sector-specific assumptions about **taxable sales share** and **profit margins**.

This produces a more defensible result than subtracting 24.3% from some broad aggregate, because:
- Sales tax applies differently across sectors and states.
- Income tax depends on net income (profit), not gross receipts.
- The “substitution effect” is concentrated in a narrow set of discretionary categories.

---

## 2) Model Definitions

### Key terms
- **AGR (Adjusted Gross Revenue):** Casino gross gaming revenue after payouts, typically the base for casino taxation (varies by state definition).
- **Local Share % (LS):** Share of casino AGR attributable to local residents whose spending would otherwise have occurred in the local economy.
- **Local Displacement Base (Base_local):** Portion of AGR subject to displacement.
- **Displacement coefficient (k):** 0.243 (the “243 coefficient”).
- **Total displaced revenue (D_total):** Estimated local spending diverted away from non-casino local businesses.
- **Sector allocation weight (w_s):** Proportion of D_total assigned to sector *s*.
- **Taxability factor (t_s):** Share of sector sales that are subject to sales tax in the selected state.
- **Net income margin (m_s):** Sector net income margin used to estimate profit loss from displaced receipts.
- **Effective personal income tax rate (r_inc):** Rate applied to profit loss (assumes pass-through taxation dominates local small businesses).

### Units and signs
- Treat all values as **annual dollars** (unless your application uses a different time basis; if so, normalize to annual first).
- Tax impacts should be returned as **negative** values (lost revenue) to avoid sign confusion downstream.

---

## 3) Methodology & Logic

### Step 1 — Establish Local Displacement Base (Base_local)
The displacement coefficient should apply only to money that would have otherwise circulated locally.

**Formula:**  
`Base_local = AGR × LS`

**UI control:**  
Expose **Local Share %** as a slider or scenario toggle.

**Suggested defaults:**
- Regional convenience-oriented casinos: **80–90%** local share
- Major tourist destinations: **40–60%** local share

> Implementation note: Present these as “scenario presets” rather than claiming they are universally correct.

---

### Step 2 — Calculate Total Displaced Revenue (D_total)
Apply the displacement coefficient to the local base.

**Formula:**  
`D_total = Base_local × k`  
Where `k = 0.243`

---

### Step 3 — Identify “At-Risk” Inventory (businesses)
Use your MapLibre/Turf.js + address/business layer to count and classify businesses within an **impact radius**.

**Radius guidance (typical):**
- 10 miles: most conservative/local
- 20 miles: mid-range
- 30 miles: broader “regional spillover”

**NAICS filters (discretionary competition):**
- **NAICS 72**: Accommodation & Food Services
- **NAICS 44–45**: Retail Trade
- **NAICS 71**: Arts, Entertainment & Recreation

**Rationale:** Excludes sectors unlikely to be materially substituted by casino spending (manufacturing, healthcare, most B2B services).

**Output needed from this step:**
- Business counts by NAICS prefix (72 / 44 / 45 / 71)
- Optional: employment proxy, square footage proxy, or sales proxy if you have it

---

### Step 4 — Allocate D_total Across Sectors (w_s)

#### Baseline (simple heuristic)
If you do **not** have reliable local business size proxies, use fixed weights:

- Dining/Hospitality (NAICS 72): `w_72 = 0.60`
- Retail (NAICS 44–45 combined): `w_44_45 = 0.30`
- Entertainment (NAICS 71): `w_71 = 0.10`

**Important fix:**  
Do **not** assign 0.30 to both 44 and 45 simultaneously. Treat 44–45 as a combined retail bucket and split internally if needed.

#### Improved (data-driven weights, recommended)
Use your business inventory to modulate weights so that areas with a heavy retail footprint allocate more displacement to retail, etc.

A practical approach that remains defensible without revenue data:

1) Compute “sector presence” from counts (or better, counts × proxy):
- `presence_s = count_s`  
  or  
- `presence_s = count_s × proxy_s` (employees, sqft, etc.)

2) Multiply by baseline weights as priors:
- `rawWeight_s = baselineWeight_s × presence_s`

3) Normalize:
- `w_s = rawWeight_s / Σ(rawWeight)`

This preserves your 60/30/10 intuition while letting the local business mix matter.

---

### Step 5 — Tax Waterfall (sector-specific)

#### A) Sales tax loss
**Formula:**  
`LostSalesTax_s = SectorLoss_s × t_s × r_sales`

Where:
- `SectorLoss_s = D_total × w_s`
- `t_s` is the sector’s taxable sales ratio **for the chosen state**
- `r_sales` is the state/local sales tax rate used in your model

**State dependency warning:** Sales tax bases vary widely by state (and sometimes locality). Retail is often close to 100% taxable, but many services/entertainment categories are partially or fully exempt depending on the state.

#### B) Income tax loss (pass-through assumption)
**Formula:**  
`LostIncomeTax_s = (SectorLoss_s × m_s) × r_inc`

Where:
- `m_s` is the net income margin proxy for sector *s*
- `r_inc` is effective personal income tax rate (state + local, if applicable)

**Optional extension (recommended):** Support states with no personal income tax or unusual business taxes by allowing:
- `r_inc_personal`
- `r_inc_corporate` (optional)
- `passThroughShare` (0–1) to blend personal/corporate treatments if desired

Example blended income tax:
`r_inc_effective = passThroughShare × r_inc_personal + (1 - passThroughShare) × r_inc_corporate`

---

## 4) Data Sourcing Strategy

### Primary source (as proposed)
**IRS Statistics of Income (SOI)** — Nonfarm Sole Proprietorship Statistics (Table 1)  
Metric: `Net Income (less deficit) / Business Receipts` by NAICS

**Rationale for proxy:**
- Pass-through firms (sole props, partnerships, S-corps) dominate many small-business categories.
- Sole prop “net income” includes owner compensation, which can make margins higher than C-corp style “profit,” which is conservative for *taxable income impact*.

### Important implementation note
The margin values in your config must be traceable to a specific table/year. Your UI should show:
- Source dataset name
- Tax year
- NAICS mapping approach (prefix-level vs full code)
- A “last updated” date for the benchmark dataset

### Required disclaimer text (UI)
> **Methodology Note:** To estimate the loss in local income tax revenue, this model uses IRS Statistics of Income (SOI) data for Nonfarm Sole Proprietorships. We assume displaced businesses operate at profit margins similar to the average sole proprietorship in their respective industry. This approximates the tax impact on local pass-through businesses and is intended for scenario analysis, not precise forecasting.

---

## 5) Technical Implementation

### A) Configuration Schema (recommended structure)
Use a **single sector list** with NAICS prefixes, rather than duplicating keys (44 and 45). Also separate the **baseline weight** (a prior) from the **final weight** (which may be data-driven).

```json
{
  "displacementCoefficient": 0.243,
  "sectors": [
    {
      "id": "72",
      "naicsPrefixes": ["72"],
      "description": "Accommodation & Food Services",
      "margin": 0.064,
      "baselineWeight": 0.60,
      "taxableSalesRatio": {
        "default": 0.95
      }
    },
    {
      "id": "44_45",
      "naicsPrefixes": ["44", "45"],
      "description": "Retail Trade",
      "margin": 0.039,
      "baselineWeight": 0.30,
      "taxableSalesRatio": {
        "default": 1.00
      }
    },
    {
      "id": "71",
      "naicsPrefixes": ["71"],
      "description": "Arts, Entertainment & Recreation",
      "margin": 0.220,
      "baselineWeight": 0.10,
      "taxableSalesRatio": {
        "default": 0.00
      }
    }
  ]
}
```

**Why this is better:**
- Prevents accidental double-counting of retail weights.
- Allows you to add more sectors later without rewriting logic.
- Allows state-specific overrides by swapping `taxableSalesRatio[stateAbbrev]` when available.

---

### B) State-specific tax rules (recommended improvement)
Do not hard-code “services are 0% taxable” globally. Instead, implement a state taxability table with a fallback default.

```json
{
  "stateTaxRules": {
    "IN": {
      "salesTaxRate": 0.07,
      "personalIncomeTaxRate": 0.0315,
      "sectorTaxabilityOverrides": {
        "71": 0.00,
        "72": 0.95,
        "44_45": 1.00
      }
    }
  }
}
```

> If you later want to support local option taxes, treat them as a separate parameter (e.g., county rate add-on) and compute `r_sales_total` per location.

---

### C) Sensitivity Controls (optional but valuable)
Add a “Market Resilience” control that multiplies margins. This is a sensible uncertainty knob because margin assumptions drive income tax losses.

- Conservative: `marginMultiplier = 0.8`
- Baseline: `1.0`
- High-margin: `1.2`

Also consider adding a **Displacement Sensitivity** control (e.g., `kMultiplier`) to allow sensitivity around the 0.243 coefficient without implying it is fixed truth everywhere.

---

### D) Calculation Logic (TypeScript/JavaScript pseudocode)

```ts
type TaxRates = {
  salesTax: number;     // state + local combined if desired
  incomeTaxPersonal: number;
  incomeTaxCorporate?: number;   // optional
  passThroughShare?: number;     // optional, default 1.0
};

type Sector = {
  id: string;
  naicsPrefixes: string[];
  description: string;
  margin: number;
  baselineWeight: number;
  taxableSalesRatio: number; // resolved for state
};

type BusinessMix = {
  // counts (or counts * proxy) for each sector id
  [sectorId: string]: number;
};

function normalizeWeights(sectors: Sector[], mix?: BusinessMix): Record<string, number> {
  // If mix provided, build presence-weighted weights; otherwise baseline weights only.
  const raw: Record<string, number> = {};
  let sum = 0;

  for (const s of sectors) {
    const presence = mix ? (mix[s.id] ?? 0) : 1;
    const v = s.baselineWeight * Math.max(presence, 0);
    raw[s.id] = v;
    sum += v;
  }

  // Fallback: if mix is empty/zero, use baseline weights directly.
  if (sum === 0) {
    sum = sectors.reduce((acc, s) => acc + s.baselineWeight, 0) || 1;
    for (const s of sectors) raw[s.id] = s.baselineWeight;
  }

  const w: Record<string, number> = {};
  for (const s of sectors) w[s.id] = raw[s.id] / sum;
  return w;
}

function calculateNetEconomicImpact(
  casinoAGR: number,
  localSharePercent: number,   // e.g. 0.90
  taxRates: TaxRates,
  sectors: Sector[],
  displacementCoefficient = 0.243,
  marginMultiplier = 1.0,
  businessMix?: BusinessMix
) {
  // 1) Establish scope
  const localBase = casinoAGR * localSharePercent;
  const totalDisplacement = localBase * displacementCoefficient;

  // 2) Resolve effective income tax rate (optional blended model)
  const passThroughShare = taxRates.passThroughShare ?? 1.0;
  const rCorp = taxRates.incomeTaxCorporate ?? 0;
  const incomeTaxRate = passThroughShare * taxRates.incomeTaxPersonal + (1 - passThroughShare) * rCorp;

  // 3) Determine weights (baseline or data-driven)
  const weights = normalizeWeights(sectors, businessMix);

  let totalLostSalesTax = 0;
  let totalLostIncomeTax = 0;

  for (const s of sectors) {
    const w = weights[s.id] ?? 0;
    const sectorLoss = totalDisplacement * w;

    // Sales tax loss
    totalLostSalesTax += sectorLoss * s.taxableSalesRatio * taxRates.salesTax;

    // Income tax loss
    const profitLoss = sectorLoss * (s.margin * marginMultiplier);
    totalLostIncomeTax += profitLoss * incomeTaxRate;
  }

  return {
    localBase,
    totalDisplacement,
    totalLostSalesTax,
    totalLostIncomeTax,
    netTaxImpact: -(totalLostSalesTax + totalLostIncomeTax)
  };
}
```

---

## 6) MapLibre/Turf Integration Notes

### Business retrieval (minimum viable)
- Query businesses within a radius of the casino point (or polygon isochrone boundary if you extend this later).
- Required fields:
  - `name`
  - `naics_code` (or a mapping to NAICS prefix)
  - geometry (point)

### Weighting input for the model
At minimum, compute counts by sector bucket:
- `mix["72"] = count(NAICS startsWith 72)`
- `mix["44_45"] = count(NAICS startsWith 44 OR 45)`
- `mix["71"] = count(NAICS startsWith 71)`

Then pass `mix` into the model for data-driven weights.

> If you do not have NAICS for all businesses, implement a fallback mapping (e.g., OSM categories → NAICS buckets) and track coverage rate in the UI.

---

## 7) Validation & Guardrails (recommended)

### Input validation
- `0 ≤ localSharePercent ≤ 1`
- `casinoAGR ≥ 0`
- Ensure sector weights normalize to 1
- Ensure `taxableSalesRatio` is `0–1`
- Ensure margins are `0–1` (or explain if using alternate definitions)

### Output sanity checks
- `totalLostSalesTax ≤ totalDisplacement × salesTaxRate`
- `totalLostIncomeTax ≤ totalDisplacement × marginMax × incomeTaxRate`
- If business mix is missing, explicitly tag the output as “baseline weights” scenario.

### UI transparency
Display a collapsible “Assumptions” panel showing:
- local share
- displacement coefficient
- sector weights (final)
- taxable ratios (per sector)
- margins (per sector) and margin multiplier
- tax rates applied

This is the difference between a model people can audit and a black box.

---

## 8) Limitations (must be stated somewhere in UI)

- The displacement coefficient is an empirical generalization and may not transfer perfectly to every market.
- Sector weights are heuristic unless business-mix weighting is enabled (recommended).
- Profit margins are proxies; real margins vary by firm size, local cost structure, and business mix within each NAICS bucket.
- The approach estimates **tax impact only** from displaced spending; it does not address second-order effects (employment shifts, supplier impacts, wage effects) unless you deliberately add them later.

---

## 9) Implementation Checklist

1. Add config file:
   - displacement coefficient
   - sector list with margins, baseline weights, taxable ratios defaults
2. Add state tax rules:
   - sales tax rate
   - personal income tax rate
   - optional corporate tax rate + pass-through share
   - per-sector taxability overrides where known
3. Build business inventory query:
   - radius-based and NAICS-filtered
   - compute counts by sector bucket
4. Compute final sector weights:
   - baseline-only fallback
   - business-mix weighting when counts exist
5. Implement calculation function and return structured output
6. Add UI controls:
   - Local share slider + presets
   - Market resilience (margin multiplier)
   - Optional displacement sensitivity (k multiplier)
7. Add audit panel + disclaimer text
8. Unit tests:
   - weight normalization
   - baseline vs mix-based weighting
   - state override logic
   - regression tests for known scenarios

---

## 10) Suggested Future Enhancements (if you want to tighten credibility)

- Replace counts-only weighting with an **employment-weighted** proxy using public datasets (where feasible).
- Move from radius to **drive-time isochrones** once your Valhalla integration is stable.
- Add a coverage metric: “% of businesses classified by NAICS” and show it to users.
- Expand sector set if you have a defensible reason (e.g., gasoline, convenience retail, quick-service vs full-service, etc.).

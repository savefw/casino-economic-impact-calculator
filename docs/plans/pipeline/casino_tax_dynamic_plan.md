# Dynamic Casino Tax Models (Nationwide) — Postgres/PostGIS-Backed Plan

This document is written as an instruction handoff for Gemini CLI.

---

## 0) Objective

Your current “Casino Tax” widget is hard-coded to Indiana’s AGR bracket model. Update the system so that:

1) The UI/engine selects a **state-specific tax model** based on the chosen location,  
2) The calculator uses **data-driven tax rules** (not state-specific code branches),  
3) The system supports **multiple regimes** (commercial casino, racino/VLT, tribal compact where applicable), and  
4) Tax models can be updated by editing **database records** (with audit metadata + effective dates), and tests validate calculations.

You already have **state and county** GIS data. Use it to determine jurisdiction from map clicks and to support future county/city variants.

---

## 1) Design Constraints (Non-negotiable)

- No tax logic hard-coded to a particular state.
- The engine must support:
  - Flat rates (single % of base)
  - Graduated brackets (tiers)
  - “Off-the-top” taxes (apply before deductions)
  - Deductions/exemptions (e.g., free play / promo credit caps, first-$X exempt)
  - Multi-component taxes (state + local + mandatory contributions)
  - Per-game category rates (slots vs table games vs ETG)
  - Per-period taxation (monthly vs annual) with deterministic conversion rules
- Every tax model entry must carry **source metadata** (URL + “as-of” date) and be **effective-dated** for auditability.

---

## 2) Store Tax Models in Postgres (source of truth)

### 2.1 Tables (SQL)

Create these tables in your existing Postgres database.

> Notes
> - Use `JSONB` for rule sets to keep the system flexible as you add new states and tax structures.
> - Use effective dating (`valid_from`, `valid_to`) to preserve historical schedules and enable “as of” calculations.

```sql
-- 1) Model header
CREATE TABLE IF NOT EXISTS casino_tax_model (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_fips      TEXT NOT NULL,              -- or omit if you don't track FIPS
  state_code      CHAR(2) NOT NULL,            -- USPS, e.g., 'IN'
  regime          TEXT NOT NULL,               -- 'commercial_casino' | 'racino_vlt' | 'tribal_compact' | 'other'
  period          TEXT NOT NULL,               -- 'annual' | 'monthly'
  currency        TEXT NOT NULL DEFAULT 'USD',
  variant_key     TEXT NULL,                   -- e.g., 'detroit', 'upstate', 'county:061'
  priority        INT  NOT NULL DEFAULT 100,   -- lower wins (for fallback ordering within state)
  valid_from      DATE NOT NULL,
  valid_to        DATE NULL,
  status          TEXT NOT NULL DEFAULT 'modeled', -- 'modeled' | 'varies' | 'deprecated'
  notes           TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_casino_tax_model_lookup
  ON casino_tax_model(state_code, regime, valid_from, valid_to, priority);

-- 2) Rule set payload (JSONB)
CREATE TABLE IF NOT EXISTS casino_tax_rule_set (
  tax_model_id    UUID PRIMARY KEY REFERENCES casino_tax_model(id) ON DELETE CASCADE,
  schema_version  INT NOT NULL DEFAULT 1,
  rule_set        JSONB NOT NULL,
  checksum        TEXT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Sources for auditability
CREATE TABLE IF NOT EXISTS casino_tax_source (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_model_id    UUID NOT NULL REFERENCES casino_tax_model(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  as_of           DATE NOT NULL,
  notes           TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_casino_tax_source_model
  ON casino_tax_source(tax_model_id);
```

### 2.2 JSONB Rule Set Schema (schema_version = 1)

The `rule_set` JSONB should follow this structure (mirrors the engine capabilities):

```json
{
  "inputs": [ { "key": "agr", "label": "Adjusted Gross Revenue (AGR)", "required": true } ],
  "categories": [ { "key": "general", "label": "General casino gaming" } ],
  "deductions": [
    {
      "id": "free_play_exempt_first_7m",
      "applies_to_input": "agr",
      "kind": "exempt_first",
      "amount": 7000000
    }
  ],
  "taxes": [
    {
      "id": "supplemental_tax",
      "name": "Supplemental Tax",
      "kind": "flat",
      "rate": 0.035,
      "base": { "type": "input", "key": "agr" },
      "notes": "Applied off the top."
    },
    {
      "id": "wagering_tax",
      "name": "Wagering Tax",
      "kind": "brackets",
      "base": { "type": "derived", "formula": "max(0, agr - 7000000)" },
      "brackets": [
        { "up_to": 25000000, "rate": 0.15 },
        { "up_to": 50000000, "rate": 0.20 },
        { "up_to": null, "rate": 0.40 }
      ]
    }
  ],
  "engine_notes": [ "Any calculation assumptions to display to users." ]
}
```

#### Supported `deductions.kind` values
- `exempt_first` (first X dollars exempt)
- `fixed_amount` (subtract fixed amount)
- `percent_cap` (cap deduction as % of base — only usable if you have that input)

#### Supported `taxes.kind` values
- `flat`
- `brackets`

#### `base.type` values
- `input` (use an input key)
- `derived` (safe formula from inputs; no arbitrary code)

---

## 3) Jurisdiction selection (use your existing state/county data)

### 3.1 From a map click to a state

You already have state and county geometry. Prefer your own PostGIS boundary lookup over third-party geocoding:

- Given a click point (lon/lat), run:
  - `SELECT state_code FROM states WHERE ST_Contains(geom, ST_SetSRID(ST_Point(:lon,:lat),4326));`
- If you have counties available and want future variants:
  - `SELECT county_fips, state_code FROM counties WHERE ST_Contains(geom, point_geom);`

### 3.2 Variant logic (future-proofing)

Start simple: use state-level model.

Add variants later via `variant_key` + `priority`:

- Example: Michigan has Detroit-specific city tax. If you add a Detroit city polygon, pick `variant_key='detroit'` with higher priority (lower number).
- If you only have counties now: support county-based variants as `variant_key='county:XYZ'`.

---

## 4) Model Selection Query (server-side)

Create a function:

`getCasinoTaxModel({ stateCode, countyFips?, asOf, preferredRegime? })`

Selection rules:

1) Determine candidate regimes in order:
   - If `preferredRegime` set: try it first
   - Then fallback order:
     1) `commercial_casino`
     2) `racino_vlt`
     3) `tribal_compact`
     4) `other`

2) Filter effective-dated:
   - `valid_from <= :asOf AND (valid_to IS NULL OR valid_to > :asOf)`

3) Apply variant preference:
   - If variant is detected (e.g., detroit / county), try matching `variant_key` first.
   - Then fall back to `NULL variant_key`.

4) Choose by `priority` ascending.

Example SQL (sketch):

```sql
SELECT m.*, rs.rule_set
FROM casino_tax_model m
JOIN casino_tax_rule_set rs ON rs.tax_model_id = m.id
WHERE m.state_code = :state_code
  AND m.regime = :regime
  AND m.valid_from <= :as_of
  AND (m.valid_to IS NULL OR m.valid_to > :as_of)
  AND (m.variant_key = :variant_key OR m.variant_key IS NULL)
ORDER BY
  CASE WHEN m.variant_key = :variant_key THEN 0 ELSE 1 END,
  m.priority ASC
LIMIT 1;
```

---

## 5) Tax Calculation Engine (data-driven)

Create a reusable module:

- `src/tax/taxEngine.ts` (or `.js`)

### 5.1 Supported rule types

Implement these primitives:

1) `flat(rate, baseAmount)`  
2) `brackets([{ up_to, rate }], baseAmount)`  
3) `deductions` pipeline to compute derived bases  
4) Apply each tax independently to its base (no compounding unless explicitly modeled)

### 5.2 Bracket computation definition (must match finance convention)

Given brackets with cumulative `up_to` thresholds:

- Tier i taxable amount = `min(base, up_to_i) - prior_up_to`
- Tax for tier i = `tier_amount * rate_i`
- For last tier (`up_to: null`): `tier_amount = base - prior_up_to` (if positive)

### 5.3 Period conversions

- If model `period = monthly` but UI input is annual:
  - `monthly = annual / 12` → apply monthly tax → multiply result by 12.
- Display a note that this assumes smooth monthly revenue.

### 5.4 Output structure

Return a structured breakdown used by the UI:

```ts
type TaxLine = {
  id: string;
  name: string;
  amount: number;
  rate?: number;
  details?: any;
};

type TaxResult = {
  modelId: string;
  input: { [k: string]: number };
  derived: { [k: string]: number };
  lines: TaxLine[];
  totalTax: number;
  effectiveRate: number;
  notes: string[];
  sources: { title: string; url: string; asOf: string }[];
};
```

---

## 6) API shape (recommended)

Add endpoints (or equivalent functions) in your backend:

1) `GET /api/casino-tax/model?lat=..&lon=..&asOf=YYYY-MM-DD`
   - Returns selected model header + sources + rule_set schema_version (for transparency)

2) `POST /api/casino-tax/calc`
   - Body:
     - `lat`, `lon`, `asOf`
     - `inputs` (agr/ggr/etc)
     - optional `preferredRegime`
   - Response: `TaxResult`

This keeps the client thin and avoids shipping all state models to browsers.

---

## 7) Seeding & Updates Workflow (DB-first, git-friendly)

You will maintain a small “seed” folder in git for review, but the DB is authoritative:

- `seed/casino_tax_models_seed.yaml` (human-reviewable)
- A script:
  - `scripts/importCasinoTaxModels.ts`
  - Loads YAML/JSON
  - Upserts:
    - `casino_tax_model`
    - `casino_tax_rule_set`
    - `casino_tax_source`

### 7.1 Upsert rules

- Uniqueness key for models:
  - `(state_code, regime, period, variant_key, valid_from)`
- If an existing model is superseded:
  - set prior `valid_to = new_valid_from`
- Always update `updated_at`.

---

## 8) Initial Seed Models (commit now)

Seed the same initial models as previously provided (IN, IL, NV, NJ, PA, NY-upstate, OH, MI-Detroit, MA Cat 1 + Cat 2, MS, LA), but import them into Postgres using `scripts/importCasinoTaxModels.ts`.

The seed entries must include:
- Rates/tiers
- Base definitions (AGR/GGR/etc)
- Period (monthly/annual)
- Sources (URL + as_of date)

---

## 9) Testing (Required)

Create:
- `src/tax/taxEngine.test.ts`

Minimum tests:
- Bracket math correctness (simple tier, multi-tier, and last-tier).
- Off-the-top + bracket combo (Indiana pattern).
- Monthly-period model conversion (Nevada/Mississippi patterns).
- Multi-component flat taxes (NJ pattern).
- Variant selection (MI Detroit vs default if you add both).

---

## 10) Acceptance Criteria

- Selecting an Indiana location reproduces the existing Indiana numbers exactly.
- Selecting:
  - Nevada → monthly-tier math works and annual conversion is correct.
  - New Jersey → shows 8% + 1.25% line items.
  - Michigan (Detroit) → shows 8.1% + 10.9% line items (Detroit variant).
  - Ohio → shows flat 33%.
- The UI shows model sources (URLs + as-of date).
- No state-specific logic in the calculation engine; only data-driven rules from Postgres.

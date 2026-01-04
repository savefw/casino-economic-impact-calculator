# Project Migration TODO: SaveFW (.NET 10 + Blazor)

## Tech Stack
- **Backend:** .NET 10 Web API (C#)
- **Frontend:** Blazor WebAssembly (C#)
- **Database:** PostgreSQL 18+
- **ORM:** Entity Framework Core (Npgsql)
- **Styles:** Tailwind CSS (reused from existing project)

## Phase 1: Architecture & Setup
- [x] **Solution Initialization**
    - [x] Create `SaveFW.sln`.
    - [x] Create `SaveFW.Server` (.NET 10 Web API).
    - [x] Create `SaveFW.Client` (Blazor WebAssembly).
    - [x] Create `SaveFW.Shared` (Class Library for shared models).
    - [x] Configure Project References.
- [x] **Database Setup**
    - [x] Configure PostgreSQL connection in `SaveFW.Server`.
    - [x] Initialize Entity Framework Core.

## Phase 2: JavaScript Modularization (Critical)
*Goal: Decouple logic for future extraction, specifically the Economics module.*

- [x] **Asset Extraction**
    - [x] Move images, fonts, and icons to `SaveFW.Client/wwwroot`.
- [x] **Script Breakout**
    - [x] **Slot Machine:** Extract lines ~8200-8800 to `wwwroot/js/components/slot-machine.js`.
    - [x] **Maps:** Extract Leaflet logic to `wwwroot/js/components/map.js`.
    - [x] **Economics Module:** (Grouped for potential separate repo)
        - [x] Create directory `wwwroot/js/economics/`.
        - [x] Extract Impact Calculator logic to `wwwroot/js/economics/calculator.js`.
        - [x] Extract Substitution Effect logic to `wwwroot/js/economics/substitution.js`.
        - [x] Ensure these scripts are independent modules.

## Phase 3: Backend Implementation
- [x] **Data Modeling (SaveFW.Shared)**
    - [x] Create `ImpactFact` model.
    - [x] Create `Legislator` model.
- [x] **Data Seeding**
    - [x] Parse `sources.csv` and seed `ImpactFacts` table.
    - [x] Parse `legislators.json` and seed `Legislators` table.
- [x] **API Endpoints**
    - [x] `GET /api/impacts`
    - [x] `GET /api/legislators`

## Phase 4: Frontend Implementation (Blazor)
- [x] **Layout & Styling**
    - [x] Setup `MainLayout.razor` with the original Navbar/Footer.
    - [x] Configure Tailwind CSS build process for Blazor (via CDN).
- [x] **Component Creation**
    - [x] `Hero.razor` (wraps Slot Machine JS via Interop).
    - [x] `EconomicImpact.razor` (wraps `economics/calculator.js` via Interop).
    - [x] `SubstitutionEffect.razor` (wraps `economics/substitution.js` via Interop).
    - [x] `Map.razor` (wraps Leaflet JS via Interop).
    - [x] `Legislators.razor` (Fetches from API).

## Phase 5: Dockerization
- [x] Create `Dockerfile` for `SaveFW.Server`.
- [x] Create `docker-compose.yml` (App + PostgreSQL).

## Phase 6: Verification
- [x] Verify Database Connection & Seeding.
- [x] Test JS Interop for Slot Machine (animation smoothness).
- [ ] Test JS Interop for Calculator (logic correctness).
- [ ] Verify API data fetching.

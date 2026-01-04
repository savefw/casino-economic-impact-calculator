<div align="center">

  <img src="docs/logo.svg" alt="Save Fort Wayne Logo" width="200" />

  # Save Fort Wayne
  ### Protect Our Future

  <p>
    A data-driven, grassroots platform exposing the hidden economic and social costs of proposed casino expansions.
  </p>

  <br />

  <p>
    <img src="https://img.shields.io/badge/.NET_10-512BD4?style=for-the-badge&logo=dotnet&logoColor=white" alt=".NET 10" />
    <img src="https://img.shields.io/badge/C%23-239120?style=for-the-badge&logo=c-sharp&logoColor=white" alt="C#" />
    <img src="https://img.shields.io/badge/Blazor_WASM-512BD4?style=for-the-badge&logo=blazor&logoColor=white" alt="Blazor" />
    <img src="https://img.shields.io/badge/PostgreSQL_18-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 18" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/Leaflet-199903?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet" />
  </p>

</div>

<br />

---

## Project Overview

Save Fort Wayne is an interactive open-source platform designed to educate citizens, policymakers, and researchers. It provides deterministic financial modeling and geospatial analysis regarding casino impacts on community character and fiscal health.

### Core Objectives
*   **Public Education:** Uncover documented social costs including addiction, crime, and wealth extraction.
*   **Data Transparency:** Provide interactive modeling tools to visualize community deficits.
*   **Policy Critique:** Refute marketing claims with independent studies and empirical data.
*   **Advocacy:** Mobilize the community to demand a public referendum.

---

## Key Features

| Feature | Description |
| :--- | :--- |
| Economic Impact Calculator | Interactive model allowing users to adjust AGR, tax allocation, and social costs to calculate community deficit. |
| Impact Zone Visualizer | Leaflet.js map showing high-risk (0-10mi), elevated-risk, and baseline risk zones. |
| Decoding the Spin | Comparison between marketing claims and documented realities with peer-reviewed sources. |
| Interactive Slot Machine | Visual metaphor for the "Near Miss" effect used in marketing terminology. |
| Detailed Demographics | Integrated population data for Indiana counties. |

---

## Repository Structure

```text
📁 SaveFW
├── 📁 SaveFW.Client      # Blazor WebAssembly Frontend
│   ├── 📁 Pages          # Razor Components (Hero, Map, Calculator)
│   └── 📁 wwwroot        # Static assets and modular JS files
├── 📁 SaveFW.Server      # .NET 10 Web API Backend
│   ├── 📁 Data           # DbContext and PostgreSQL Seeding Logic
│   └── 📄 Program.cs     # API Routing and Blazor Hosting
├── 📁 SaveFW.Shared      # Shared C# Class Library
│   └── 📄 Legislator.cs  # Shared Data Models
├── 📁 docs               # Documentation Assets
│   └── 📄 logo.svg       # Project Logo
├── 📄 docker-compose.yml # Orchestration for App and PostgreSQL 18
├── 📄 Dockerfile         # Multi-stage build for .NET 10
└── 📄 SaveFW.sln         # Visual Studio Solution
```

---

## Architecture

This project is built using a modern .NET 10 distributed architecture:

*   **Backend:** .NET 10 Web API utilizing Entity Framework Core.
*   **Frontend:** Blazor WebAssembly styled with Tailwind CSS.
*   **Database:** PostgreSQL 18 (Dockerized) with automated data seeding.
*   **Maps:** Leaflet.js integrated via JavaScript Interop.
*   **Deployment:** Fully containerized environment via Docker Compose.

---

## Getting Started

### Prerequisites
*   .NET 10 SDK
*   Docker & Docker Compose

### Running with Docker

Initialize the database and application containers:

```bash
docker compose up --build -d
```

Access the application at: http://localhost:8080 (or the assigned host IP).

### Local Development

To run the server directly:

```bash
export PATH=$PATH:/root/.dotnet
cd SaveFW
dotnet build
dotnet run --project SaveFW.Server/SaveFW.Server.csproj --urls "http://0.0.0.0:8080"
```

---

## Open Source and Contributions

This project is shared openly to encourage community involvement. We invite developers and data scientists to:

1.  Improve the Calculator: Refine social cost algorithms and add granular data points.
2.  Enhance Visualizations: Expand mapping and charting capabilities.
3.  Audit Sources: Ensure the latest research is reflected in the platform models.

## Contact

For inquiries, feedback, or to join the coalition, please reach out to:
outreach@savefw.com

## Data and Sources

Social cost modeling is derived from established academic research:
*   Grinols (2011): Social cost per problem gambler calculations (adjusted for 2025 inflation).
*   Welte et al.: Proximity-based multipliers for gambling addiction risk.
*   Spectrum Gaming: Comparison of state-commissioned revenue projections.

---

<div align="center">
  <p><em>A volunteer effort by concerned residents of Allen County.</em></p>
  <p>
    <a href="https://savefw.com"><strong>Visit Live Site</strong></a>
  </p>
</div>
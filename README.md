<div align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
    <img alt="Save Fort Wayne Logo" src="docs/logo.svg" width="200">
  </picture>

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

### 💰 Economic Impact Calculator
The core of the platform is an interactive financial model that allows citizens to audit the "net benefit" claims made by developers. Users can adjust critical variables—including Adjusted Gross Revenue (AGR), tax revenue allocation strategies, and social cost multipliers—to calculate the true projected community deficit. Unlike static reports, this tool recalculates in real-time, showing how even optimistic revenue projections often fail to cover the public sector costs of addiction and crime.
<br />
<img src="docs/examples/Net-Economic-Impact-Table-Example.png" alt="Economic Impact Calculator Table" width="600" />
<br /><br />

### 📊 Programmatic Economic Analysis
Moving beyond "AI estimates" or "black box" consulting studies, SaveFW employs a deterministic, rule-based analysis. This system processes user inputs against fixed mathematical formulas derived from peer-reviewed economic literature (Grinols, Welte, et al.). This ensures that every result is reproducible, transparent, and mathematically verifiable, providing a "Programmatic Fact Check" that updates instantly as variables change.
<br />
<img src="docs/examples/Net-Economic-Impact-Automated-Analysis-Example.png" alt="Automated Economic Analysis" width="600" />
<br /><br />

### 🧪 Economic Impact Simulator
For users who want to explore "What If" scenarios, the Simulator provides a guided wizard. It allows users to rapidly toggle between the State's conservative revenue estimates ($43M-$112M) and the Developer's sales pitch ($330M), applying varying degrees of social cost sensitivity to see if *any* scenario results in a net positive for the taxpayer.
<br />
<img src="docs/examples/Economic-Impact-Simulator-Example.png" alt="Simulator Interface" width="600" />
<br /><br />

### 🎰 Interactive Slot Machine
A visual metaphor for the deceptive marketing tactics used to sell the casino project. The digital slot machine demonstrates the "Near Miss" psychological effect—where "JOBS" appears just one click away from "ADDICTION"—highlighting how promises of economic prosperity are often just a facade for wealth extraction.
<br />
<img src="docs/examples/Slot-Machine-Example.png" alt="Slot Machine Metaphor" width="600" />
<br /><br />

### 🗺️ Impact Zone Visualizer
This Leaflet.js-based geospatial tool visualizes the "blast radius" of problem gambling. It maps high-risk (0-10 miles), elevated-risk (10-20 miles), and baseline risk zones, dynamically calculating the number of affected households based on 2020 Census block group data.

### 🕵️ Decoding the Spin
A direct, side-by-side comparison of the marketing claims ("Economic Engine," "World-Class Destination") versus the documented reality found in similar markets ("Substitution Effect," "Market Saturation"), supported by direct links to independent studies.

### 👥 Detailed Demographics
The platform integrates granular population data for all 92 Indiana counties, allowing the impact model to be applied specifically to the local demographics of Allen County and its neighbors.

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

The easiest way to run Save Fort Wayne is using **Docker**. This ensures the application, database, and all dependencies run exactly as intended without installing anything else on your machine.

### 1. Prerequisites

You only need **Docker** installed.

<details>
<summary><strong>Click here for Docker Installation Instructions</strong></summary>

### Windows
1. Download [Docker Desktop for Windows](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe).
2. Run the installer and follow the on-screen instructions.
3. Restart your computer if prompted.
4. Open PowerShell and verify by running: `docker --version`

### macOS
1. Download [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/).
   - [Apple Silicon (M1/M2/M3)](https://desktop.docker.com/mac/main/arm64/Docker.dmg)
   - [Intel Chip](https://desktop.docker.com/mac/main/amd64/Docker.dmg)
2. Drag the Docker icon to your Applications folder.
3. Open Docker from Applications.
4. Open Terminal and verify by running: `docker --version`

### Linux (Ubuntu/Debian)
Run the convenience script to install Docker Engine:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```
Verify installation: `docker --version`

</details>

### 2. Run the Application

Once **Docker** is installed, simply clone the repo and start the containers. The repository handles everything else (database setup, data seeding, dependencies).

```bash
# 1. Clone the repository
git clone https://github.com/savefw/casino-economic-impact-calculator.git
cd casino-economic-impact-calculator/SaveFW

# 2. Start the application
docker compose up --build -d
```

The application is now running! Visit: **http://localhost:8080**

---

### For Developers (Optional)

If you wish to modify the C# code or run the application without Docker, you will need the [.NET 10 SDK](https://dotnet.microsoft.com/download).

```bash
# Local Development Command
export PATH=$PATH:/root/.dotnet
cd SaveFW
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

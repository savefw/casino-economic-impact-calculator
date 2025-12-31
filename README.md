# Save Fort Wayne - Protect Our Future

Save Fort Wayne is a grassroots coalition project dedicated to protecting the community from the hidden economic and social costs of proposed casino expansions. This repository contains the source code for the [SaveFW.com](https://savefw.com/) website, an interactive platform designed to educate citizens and provide data-driven analysis of casino impacts.

## Project Goals

- **Public Education:** Uncover the documented social costs of casinos, including addiction, crime, and wealth extraction.
- **Data Transparency:** Provide interactive modeling tools to visualize how a casino expansion affects local and neighboring counties.
- **Policy Critique:** Analyze and refute marketing claims with independent studies and empirical data.
- **Advocacy:** Mobilize the community to demand a public referendum and protect Fort Wayne's community character.

## Key Features

- **Economic Impact Calculator:** An interactive "Social Cost Model" that allows users to adjust variables (AGR, tax revenue allocation, social cost per gambler) to calculate the projected community deficit.
- **Casino Impact Zone Visualizer:** A map-based tool (Leaflet.js) showing the high-risk, elevated-risk, and baseline risk zones for problem gambling based on proximity to the proposed site.
- **Decoding the Spin:** A categorized breakdown comparing marketing "Bait" (promises) vs. the "Hook" (documented realities) with links to peer-reviewed sources and independent analysis.
- **Interactive Slot Machine:** A visual metaphor demonstrating the "Near Miss" effect and how marketing terminology is used to mask social costs.
- **County-Level Data:** Detailed demographics and population data for all 92 Indiana counties.

## Technologies Used

- **Frontend:** HTML5, Tailwind CSS (via CDN)
- **Mapping:** [Leaflet.js](https://leafletjs.com/) for interactive geographical visualizations.
- **Data Processing:** JavaScript (ES6+) for real-time calculations and UI state management.
- **Geospatial Logic:** [Turf.js](https://turfjs.org/) for impact radius calculations.
- **Content:** Markdown-based analysis reports and PDF integration.

## Getting Started

### Local Development

Since this is a static site, you can run it using any local web server.

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/save-fort-wayne.git
   ```
2. Navigate to the directory:
   ```bash
   cd save-fort-wayne
   ```
3. Start a local server (example using Python):
   ```bash
   python3 -m http.server 8000
   ```
4. Open `http://localhost:8000` in your browser.

## Data & Sources

The social cost modeling is based on established research, including:
- **Grinols (2011):** Social cost per problem gambler calculations (adjusted for 2025 inflation).
- **Welte et al.:** Proximity-based multipliers for gambling addiction risk.
- **Spectrum Gaming & Union Gaming:** Comparison of state-commissioned vs. developer-funded revenue projections.

Detailed citations and sources are available within the "Decoding the Spin" section of the site.

## Disclaimer

The information provided on this site is for educational and advocacy purposes. Calculations are estimates based on available research and historical data from comparable markets.

---
*A volunteer effort by concerned residents of Allen County.*
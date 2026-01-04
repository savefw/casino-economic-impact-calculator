#!/bin/bash
set -e

# Target directory
OSM_DIR="../osm"
mkdir -p "$OSM_DIR"

# URLs for Indiana and neighbors (Geofabrik)
URLS=(
    "https://download.geofabrik.de/north-america/us/indiana-latest.osm.pbf"
    "https://download.geofabrik.de/north-america/us/ohio-latest.osm.pbf"
    "https://download.geofabrik.de/north-america/us/michigan-latest.osm.pbf"
    "https://download.geofabrik.de/north-america/us/illinois-latest.osm.pbf"
    "https://download.geofabrik.de/north-america/us/kentucky-latest.osm.pbf"
)

echo "Downloading OSM PBFs to $OSM_DIR..."

for url in "${URLS[@]}"; do
    filename=$(basename "$url")
    filepath="$OSM_DIR/$filename"
    
    if [ -f "$filepath" ]; then
        echo "  [SKIP] $filename already exists."
    else
        echo "  [DOWN] Downloading $filename..."
        wget -q --show-progress -O "$filepath" "$url"
    fi
done

echo "Done."

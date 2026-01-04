window.ImpactMap = (function ()
{
    let map;
    let marker;
    let circle10, circle20;
    let stateLayer, highlightLayer, blockGroupLayer, tractLayer, scoresLayer;
    let stateData, currentGeoJSON;
    let currentCountyId;
    let satelliteTileLayer, streetTileLayer;
    let cache = {};

    // Initial default Layers State
    const layersVisible = {
        zones: true,
        boundary: true,
        overlay: true,
        blocks: false,
        tracts: false,
        heatmap: false,
        streets: false
    };

    const countyReference = [
        { id: "001", name: "Adams", pop: 35809 }, { id: "003", name: "Allen", pop: 385410 }, { id: "005", name: "Bartholomew", pop: 82208 },
        { id: "007", name: "Benton", pop: 8719 }, { id: "009", name: "Blackford", pop: 12112 }, { id: "011", name: "Boone", pop: 70812 },
        { id: "013", name: "Brown", pop: 15475 }, { id: "015", name: "Carroll", pop: 20306 }, { id: "017", name: "Cass", pop: 37870 },
        { id: "019", name: "Clark", pop: 121093 }, { id: "021", name: "Clay", pop: 26466 }, { id: "023", name: "Clinton", pop: 33190 },
        { id: "025", name: "Crawford", pop: 10526 }, { id: "027", name: "Daviess", pop: 33381 }, { id: "029", name: "Dearborn", pop: 50679 },
        { id: "031", name: "Decatur", pop: 26472 }, { id: "033", name: "DeKalb", pop: 43265 }, { id: "035", name: "Delaware", pop: 111903 },
        { id: "037", name: "Dubois", pop: 43637 }, { id: "039", name: "Elkhart", pop: 207047 }, { id: "041", name: "Fayette", pop: 23398 },
        { id: "043", name: "Floyd", pop: 80484 }, { id: "045", name: "Fountain", pop: 16479 }, { id: "047", name: "Franklin", pop: 22785 },
        { id: "049", name: "Fulton", pop: 20480 }, { id: "051", name: "Gibson", pop: 33011 }, { id: "053", name: "Grant", pop: 66674 },
        { id: "055", name: "Greene", pop: 30803 }, { id: "057", name: "Hamilton", pop: 347467 }, { id: "059", name: "Hancock", pop: 79840 },
        { id: "061", name: "Harrison", pop: 39654 }, { id: "063", name: "Hendricks", pop: 174788 }, { id: "065", name: "Henry", pop: 48914 },
        { id: "067", name: "Howard", pop: 82544 }, { id: "069", name: "Huntington", pop: 36662 }, { id: "071", name: "Jackson", pop: 46428 },
        { id: "073", name: "Jasper", pop: 32918 }, { id: "075", name: "Jay", pop: 20478 }, { id: "077", name: "Jefferson", pop: 33147 },
        { id: "079", name: "Jennings", pop: 27613 }, { id: "081", name: "Johnson", pop: 161765 }, { id: "083", name: "Knox", pop: 36282 },
        { id: "085", name: "Kosciusko", pop: 80240 }, { id: "087", name: "LaGrange", pop: 40446 }, { id: "089", name: "Lake", pop: 498700 },
        { id: "091", name: "LaPorte", pop: 112417 }, { id: "093", name: "Lawrence", pop: 45011 }, { id: "095", name: "Madison", pop: 130129 },
        { id: "097", name: "Marion", pop: 977203 }, { id: "099", name: "Marshall", pop: 46095 }, { id: "101", name: "Martin", pop: 9812 },
        { id: "103", name: "Miami", pop: 35962 }, { id: "105", name: "Monroe", pop: 139718 }, { id: "107", name: "Montgomery", pop: 37936 },
        { id: "109", name: "Morgan", pop: 71780 }, { id: "111", name: "Newton", pop: 13830 }, { id: "113", name: "Noble", pop: 47457 },
        { id: "115", name: "Ohio", pop: 5940 }, { id: "117", name: "Orange", pop: 19867 }, { id: "119", name: "Owen", pop: 21321 },
        { id: "121", name: "Parke", pop: 16156 }, { id: "123", name: "Perry", pop: 19170 }, { id: "125", name: "Pike", pop: 12250 },
        { id: "127", name: "Porter", pop: 173215 }, { id: "129", name: "Posey", pop: 25222 }, { id: "131", name: "Pulaski", pop: 12514 },
        { id: "133", name: "Putnam", pop: 36726 }, { id: "135", name: "Randolph", pop: 24502 }, { id: "137", name: "Ripley", pop: 28995 },
        { id: "139", name: "Rush", pop: 16752 }, { id: "141", name: "St. Joseph", pop: 272912 }, { id: "143", name: "Scott", pop: 24384 },
        { id: "145", name: "Shelby", pop: 45055 }, { id: "147", name: "Spencer", pop: 19810 }, { id: "149", name: "Starke", pop: 23371 },
        { id: "151", name: "Steuben", pop: 34435 }, { id: "153", name: "Sullivan", pop: 20817 }, { id: "155", name: "Switzerland", pop: 9737 },
        { id: "157", name: "Tippecanoe", pop: 186251 }, { id: "159", name: "Tipton", pop: 15359 }, { id: "161", name: "Union", pop: 7087 },
        { id: "163", name: "Vanderburgh", pop: 180136 }, { id: "165", name: "Vermillion", pop: 15439 }, { id: "167", name: "Vigo", pop: 106153 },
        { id: "169", name: "Wabash", pop: 30976 }, { id: "171", name: "Warren", pop: 8440 }, { id: "173", name: "Warrick", pop: 63898 },
        { id: "175", name: "Washington", pop: 28182 }, { id: "177", name: "Wayne", pop: 66553 }, { id: "179", name: "Wells", pop: 28180 },
        { id: "181", name: "White", pop: 24688 }, { id: "183", name: "Whitley", pop: 34191 }
    ];

    function init(mapElementId)
    {
        if (!document.getElementById(mapElementId)) return;

        map = L.map(mapElementId, {
            scrollWheelZoom: false,
            attributionControl: false,
            zoomControl: false
        }).setView([39.8, -86.15], 7);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Define Base Layers
        satelliteTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        });

        streetTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        });

        // Add default
        satelliteTileLayer.addTo(map);

        initStateMap();
        initMarker();
        initControls();
        initCountyDropdown();

        // Initial load (Allen County default)
        loadCounty("003");

        // Fix for rendering issues on load
        setTimeout(() => map.invalidateSize(), 200);

        // Interaction
        setupMapInteractions(mapElementId);
    }

    function setupMapInteractions(mapElId)
    {
        const mapContainer = document.getElementById(mapElId).parentElement;
        const onWheel = (e) =>
        {
            if (e.ctrlKey)
            {
                map.scrollWheelZoom.enable();
            } else
            {
                map.scrollWheelZoom.disable();
            }
        };
        mapContainer.addEventListener('wheel', onWheel, { passive: true });
        mapContainer.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());
    }

    async function initStateMap()
    {
        try
        {
            const res = await fetch('./data/indiana_counties_merged.json');
            stateData = await res.json();

            stateLayer = L.geoJSON(stateData, {
                style: {
                    color: '#94a3b8',
                    weight: 1,
                    fillColor: '#94a3b8',
                    fillOpacity: 0.1
                },
                interactive: true,
                onEachFeature: (feature, layer) =>
                {
                    if (feature.properties && feature.properties.NAME)
                    {
                        layer.bindTooltip(`
                            <div class="bg-slate-900 text-white text-xs p-2 font-bold">${feature.properties.NAME}</div>
                        `, { sticky: true, className: '!bg-transparent !border-0 !shadow-none' });
                    }
                    layer.on({
                        click: (e) =>
                        {
                            const countyId = feature.properties.COUNTY;
                            if (countyId) loadCounty(countyId);
                        },
                        mouseover: (e) =>
                        {
                            e.target.setStyle({ weight: 2, color: '#60a5fa', fillOpacity: 0.3 });
                        },
                        mouseout: (e) =>
                        {
                            stateLayer.resetStyle(e.target);
                        }
                    });
                }
            });

            if (layersVisible.boundary)
            {
                stateLayer.addTo(map).bringToBack();
            }
        } catch (e)
        {
            console.error("State Map Load Error", e);
        }
    }

    function initMarker()
    {
        // Default Center (Allen County approx)
        const center = [41.0793, -85.1394];

        const casinoPin = L.icon({
            iconUrl: 'assets/Casino_Map_Marker.svg',
            iconSize: [50, 88],
            iconAnchor: [25, 88],
            popupAnchor: [0, -80],
            className: 'marker-shadow-filter'
        });

        marker = L.marker(center, { draggable: true, autoPan: true, icon: casinoPin }).addTo(map);

        circle20 = L.circle(center, {
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.35,
            radius: 32186.9,
            weight: 2,
            dashArray: '5, 5'
        }).addTo(map);

        circle10 = L.circle(center, {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.25,
            radius: 16093.4,
            weight: 2
        }).addTo(map);

        marker.on('drag', () =>
        {
            const latLng = marker.getLatLng();
            circle10.setLatLng(latLng);
            circle20.setLatLng(latLng);

            // Auto switch county on drag
            if (stateData)
            {
                const pt = turf.point([latLng.lng, latLng.lat]);
                const matched = stateData.features.find(f => turf.booleanPointInPolygon(pt, f));
                if (matched)
                {
                    const newCountyId = matched.properties.COUNTY;
                    if (newCountyId !== currentCountyId)
                    {
                        loadCounty(newCountyId, true); // true = skipMarkerMove
                        updateDropdown(newCountyId);
                    }
                }
            }

            calculateImpact();
        });

        // Also update on dragend to be sure
        marker.on('dragend', () => calculateImpact());
    }

    function updateDropdown(accCountyId)
    {
        const display = document.getElementById('county-display');
        const cInfo = countyReference.find(c => c.id === accCountyId);
        if (display && cInfo)
        {
            display.textContent = `${cInfo.name} (${cInfo.pop.toLocaleString()})`;
        }
    }

    function initControls()
    {
        // Geocoder
        if (L.Control.Geocoder)
        {
            const geocoder = L.Control.Geocoder.nominatim({
                geocodingQueryParams: { countrycodes: 'us', viewbox: '-88.2,42.0,-84.6,37.5', bounded: 1 }
            });

            const geocoderControl = L.Control.geocoder({
                geocoder: geocoder,
                defaultMarkGeocode: false,
                placeholder: 'Search for an address...',
                collapsed: false,
                showResultIcons: true
            });

            // We want to place it in our custom container
            const searchContainer = document.getElementById('map-search-container');
            if (searchContainer)
            {
                const div = geocoderControl.onAdd(map);
                searchContainer.appendChild(div);

                // Add custom styling class to the input if needed or rely on CSS
            }

            geocoderControl.on('markgeocode', function (e)
            {
                const bbox = e.geocode.bbox;
                const center = e.geocode.center;

                // Move Marker
                if (marker)
                {
                    marker.setLatLng(center);
                    circle10.setLatLng(center);
                    circle20.setLatLng(center);
                    map.setView(center, 10);

                    // Trigger calc
                    calculateImpact();

                    // Check county
                    if (stateData)
                    {
                        const pt = turf.point([center.lng, center.lat]);
                        const matched = stateData.features.find(f => turf.booleanPointInPolygon(pt, f));
                        if (matched && matched.properties.COUNTY !== currentCountyId)
                        {
                            loadCounty(matched.properties.COUNTY, true);
                            updateDropdown(matched.properties.COUNTY);
                        }
                    }
                }
            });
        }

        // Fullscreen Toggle
        // const mapOverlayControls = L.control({ position: 'topright' });
        // ... omitted as not critical/implemented in snippet

        // Listener for Rate Change from Calculator
        const rateInput = document.getElementById('input-rate');
        if (rateInput)
        {
            rateInput.addEventListener('input', () =>
            {
                calculateImpact();
            });
            // Also listen for 'change' just in case
            rateInput.addEventListener('change', () =>
            {
                calculateImpact();
            });
        }
    }

    function initCountyDropdown()
    {
        const menu = document.getElementById('county-options');
        const trigger = document.getElementById('county-trigger');
        const menuContainer = document.getElementById('county-menu');
        const search = document.getElementById('county-search');

        if (!menu || !trigger) return;

        // Populate
        countyReference.sort((a, b) => a.name.localeCompare(b.name)).forEach(c =>
        {
            const div = document.createElement('div');
            div.className = "px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm text-slate-700 dark:text-slate-300 transition-colors";
            div.textContent = c.name;
            div.onclick = () =>
            {
                loadCounty(c.id);
                updateDropdown(c.id);
                // Close menu
                menuContainer.classList.add('hidden');
                menuContainer.classList.remove('opacity-100', 'scale-100');
                menuContainer.classList.add('opacity-0', 'scale-95');
            };
            menu.appendChild(div);
        });

        trigger.onclick = () =>
        {
            if (menuContainer.classList.contains('hidden'))
            {
                menuContainer.classList.remove('hidden');
                setTimeout(() =>
                {
                    menuContainer.classList.remove('opacity-0', 'scale-95');
                    menuContainer.classList.add('opacity-100', 'scale-100');
                }, 10);
            } else
            {
                menuContainer.classList.remove('opacity-100', 'scale-100');
                menuContainer.classList.add('opacity-0', 'scale-95');
                setTimeout(() => menuContainer.classList.add('hidden'), 200);
            }
        };

        if (search)
        {
            search.addEventListener('input', (e) =>
            {
                const val = e.target.value.toLowerCase();
                Array.from(menu.children).forEach(child =>
                {
                    child.style.display = child.textContent.toLowerCase().includes(val) ? 'block' : 'none';
                });
            });
        }
    }

    async function loadCounty(countyId, skipMarkerMove = false)
    {
        if (!countyId) return;

        let shouldProcess = true;
        if (cache[countyId])
        {
            currentGeoJSON = cache[countyId];
            currentCountyId = countyId;
            highlightCountyVisuals(countyId, skipMarkerMove);
            calculateImpact();
            shouldProcess = false;
        }

        if (shouldProcess)
        {
            try
            {
                const res = await fetch(`./data/counties/${countyId}.json`);
                if (!res.ok) throw new Error('County data not found');
                const data = await res.json();

                preprocessPopulation(data, countyId);

                cache[countyId] = data;
                currentGeoJSON = data;
                currentCountyId = countyId;

                highlightCountyVisuals(countyId, skipMarkerMove);
                loadScores(countyId);
                calculateImpact();
            } catch (e)
            {
                console.error("Map Error:", e);
            }
        }
    }

    async function loadScores(countyId)
    {
        if (!countyId) return;
        if (scoresLayer) map.removeLayer(scoresLayer);

        try
        {
            // Fetch scores from API
            // Note: Defaulting to 15 minutes for now; could be parameterized
            const res = await fetch(`/api/sitescores?countyId=${parseInt(countyId)}&minutes=15`);
            if (!res.ok) return; // Silent fail if no scores yet

            const scores = await res.json();

            if (!scores || scores.length === 0) return;

            // Simple visualization: Circle Markers colored by score
            // Score range assumed 0-100 for now
            scoresLayer = L.layerGroup();

            scores.forEach(s =>
            {
                const color = s.score > 80 ? '#ef4444' : (s.score > 50 ? '#f97316' : '#22c55e');
                L.circleMarker([s.lat, s.lon], {
                    radius: 4,
                    fillColor: color,
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`Score: ${s.score.toFixed(1)}`).addTo(scoresLayer);
            });

            // Add to map if heatmap/scores layer is toggled (or default to visible for now)
            // if (layersVisible.heatmap) ...
            scoresLayer.addTo(map);

        } catch (e)
        {
            console.error("Error loading scores:", e);
        }
    }

    function highlightCountyVisuals(countyId, skipMarkerMove)
    {
        const countyInfo = countyReference.find(c => c.id === countyId);
        const totalPop = countyInfo ? countyInfo.pop : 0;
        let hasPopProp = false;
        let totalArea = 0;

        turf.featureEach(geoJSON, (feature) =>
        {
            if (feature.properties.POPULATION !== undefined || feature.properties.POP !== undefined) hasPopProp = true;
            totalArea += (feature.properties.ALAND || 0);
        });

        // Estimate if missing
        if (!hasPopProp && totalArea > 0)
        {
            turf.featureEach(geoJSON, (feature) =>
            {
                const area = feature.properties.ALAND || 0;
                feature.properties._estPop = (area / totalArea) * totalPop;
            });
        }
    }

    function highlightCountyVisuals(countyId, skipMarkerMove)
    {
        if (!stateData) return;

        // 1. Highlight
        const countyFeature = stateData.features.find(f => f.properties.COUNTY === countyId);
        if (highlightLayer) map.removeLayer(highlightLayer);

        if (countyFeature)
        {
            highlightLayer = L.geoJSON(countyFeature, {
                style: { color: '#f97316', weight: 3, fillColor: '#7c2d12', fillOpacity: 0.2, dashArray: '4, 4' },
                interactive: false
            });
            if (layersVisible.overlay) highlightLayer.addTo(map).bringToFront();

            if (!skipMarkerMove && marker)
            {
                const center = turf.centroid(countyFeature);
                const latlng = [center.geometry.coordinates[1], center.geometry.coordinates[0]];
                marker.setLatLng(latlng);
                circle10.setLatLng(latlng);
                circle20.setLatLng(latlng);
                map.setView(latlng, 9);
            }
        }

        // 2. Load Block Groups Layer (simplified for parity)
        if (blockGroupLayer) map.removeLayer(blockGroupLayer);
        if (currentGeoJSON)
        {
            blockGroupLayer = L.geoJSON(currentGeoJSON, {
                style: { weight: 0.5, color: '#334155', fillOpacity: 0 },
                interactive: false
            });
            // Logic to show/hide based on layersVisible... 
            // keeping it simple for now, only showing if requested, but default is false
            if (layersVisible.blocks) blockGroupLayer.addTo(map);
        }
    }

    function calculateImpact()
    {
        if (!currentGeoJSON || !marker) return;

        const markerLatLng = marker.getLatLng();
        const centerPoint = turf.point([markerLatLng.lng, markerLatLng.lat]);

        let t1Pop = 0;
        let t2Pop = 0;
        let t3Pop = 0;

        const countyInfo = countyReference.find(c => c.id === currentCountyId);
        const totalCountyPop = countyInfo ? countyInfo.pop : 0;

        turf.featureEach(currentGeoJSON, (feature) =>
        {
            const pop = feature.properties.POPULATION || feature.properties.POP || feature.properties._estPop || 0;
            let centroid = null;
            try { centroid = turf.centroid(feature); } catch (e) { return; }
            const dist = turf.distance(centerPoint, centroid, { units: 'miles' });

            if (dist <= 10) t1Pop += pop;
            else if (dist <= 20) t2Pop += pop;
        });

        t3Pop = Math.max(0, totalCountyPop - t1Pop - t2Pop);

        // Update DOM
        // Note: ids match Map.razor (val-t1..t3)
        updateVal('val-t1', t1Pop);
        updateVal('val-t2', t2Pop);

        // Calculate Victims based on Rate (Bridge to Calculator)
        const rateEl = document.getElementById('input-rate');
        const tvEl = document.getElementById('total-gamblers');
        const baselineRate = parseFloat(rateEl ? rateEl.value : 2.3);

        if (tvEl)
        {
            const r1 = baselineRate * 2.0;
            const r2 = baselineRate * 1.5;
            const r3 = baselineRate * 1.0;

            const v1 = t1Pop * (r1 / 100);
            const v2 = t2Pop * (r2 / 100);
            const v3 = t3Pop * (r3 / 100);
            const totalVictims = v1 + v2 + v3;

            animateValue(tvEl, totalVictims);

            // Trigger Calculator Update
            if (rateEl) rateEl.dispatchEvent(new Event('input'));
        }

        // Logic for T3 label
        const elT3 = document.getElementById('val-t3');
        const labelT3 = document.getElementById('label-t3');

        if (elT3)
        {
            if (t3Pop === 0 && totalCountyPop > 0)
            {
                elT3.textContent = "Fully Captured";
                elT3.classList.add('text-xs', 'uppercase');
                if (labelT3) labelT3.textContent = "by Preceding Impact Zones";
            } else
            {
                animateValue(elT3, t3Pop);
                elT3.classList.remove('text-xs', 'uppercase');
                if (labelT3) labelT3.textContent = "Population";
            }
        }

        // Trigger event for Calculator logic if needed
        // We can use a custom event or direct call if exposed
    }

    function updateVal(id, val)
    {
        const el = document.getElementById(id);
        if (el) animateValue(el, val);
    }

    function animateValue(obj, val)
    {
        if (!obj) return;
        obj.textContent = Math.round(val).toLocaleString();
        // Full animation logic omitted for brevity, simple text update is sufficient for functionality
    }

    return { init: init };
})();

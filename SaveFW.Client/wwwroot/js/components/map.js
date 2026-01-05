window.ImpactMap = (function ()
{

    // --- SHARED DATA & STATE ---
    // County reference data is loaded from shared module: js/data/indiana-counties.js
    // Access via window.IndianaCounties
    const getCountyReference = () => window.IndianaCounties || [];

    const cache = {};

    return {
        init: function (elementId)
        {
            let currentGeoJSON = null;
            let currentCountyId = "003"; // Allen Default
            let stateLayer = null;
            let highlightLayer = null;
            let blockGroupLayer = null;
            let tractLayer = null;
            let stateData = null;
            let satelliteTileLayer = null;
            let streetTileLayer = null;

            // Layer State
            const layersVisible = {
                zones: true, boundary: true, overlay: true,
                blocks: false, tracts: false, heatmap: false, streets: false
            };

            // Global Handlers
            window.toggleMapOverlay = function ()
            {
                const panel = document.getElementById('map-overlay-panel');
                if (panel)
                {
                    if (panel.classList.contains('-translate-x-[120%]')) panel.classList.remove('-translate-x-[120%]');
                    else panel.classList.add('-translate-x-[120%]');
                }
            };

            window.toggleLayer = function (id)
            {
                const cb = document.getElementById('layer-' + id);
                if (cb)
                {
                    layersVisible[id] = cb.checked;
                    if (id === 'heatmap')
                    {
                        if (blockGroupLayer && currentGeoJSON) blockGroupLayer.setStyle(getHeatMapStyle);
                    }
                    if (id === 'streets') updateBaseLayer();
                    else updateLayerVisibility();
                }
            };

            function updateBaseLayer()
            {
                if (layersVisible.streets)
                {
                    if (map.hasLayer(satelliteTileLayer)) map.removeLayer(satelliteTileLayer);
                    if (!map.hasLayer(streetTileLayer)) map.addLayer(streetTileLayer);
                } else
                {
                    if (map.hasLayer(streetTileLayer)) map.removeLayer(streetTileLayer);
                    if (!map.hasLayer(satelliteTileLayer)) map.addLayer(satelliteTileLayer);
                }
                updateLayerVisibility();
            }

            function updateLayerVisibility()
            {
                // Zones
                if (layersVisible.zones)
                {
                    if (!map.hasLayer(circle10)) map.addLayer(circle10);
                    if (!map.hasLayer(circle20)) map.addLayer(circle20);
                } else
                {
                    if (map.hasLayer(circle10)) map.removeLayer(circle10);
                    if (map.hasLayer(circle20)) map.removeLayer(circle20);
                }
                // Selected County Overlay
                if (highlightLayer)
                {
                    if (layersVisible.overlay)
                    {
                        if (!map.hasLayer(highlightLayer)) map.addLayer(highlightLayer);
                        highlightLayer.bringToFront();
                    } else
                    {
                        if (map.hasLayer(highlightLayer)) map.removeLayer(highlightLayer);
                    }
                }
                // County Boundaries (State)
                if (stateLayer)
                {
                    if (layersVisible.boundary)
                    {
                        if (!map.hasLayer(stateLayer)) map.addLayer(stateLayer);
                        stateLayer.bringToBack();
                    } else
                    {
                        if (map.hasLayer(stateLayer)) map.removeLayer(stateLayer);
                    }
                }
                // Blocks & Heatmap
                if (blockGroupLayer)
                {
                    if (layersVisible.blocks || layersVisible.heatmap)
                    {
                        if (!map.hasLayer(blockGroupLayer)) map.addLayer(blockGroupLayer);
                        blockGroupLayer.setStyle(getHeatMapStyle);
                        blockGroupLayer.bringToBack();
                    } else
                    {
                        if (map.hasLayer(blockGroupLayer)) map.removeLayer(blockGroupLayer);
                    }
                }
                // Census Tracts
                if (tractLayer)
                {
                    if (layersVisible.tracts)
                    {
                        if (!map.hasLayer(tractLayer)) map.addLayer(tractLayer);
                        tractLayer.bringToFront();
                        if (highlightLayer && layersVisible.overlay) highlightLayer.bringToFront();
                    } else
                    {
                        if (map.hasLayer(tractLayer)) map.removeLayer(tractLayer);
                    }
                }
                // Top ordering
                if (layersVisible.zones)
                {
                    circle20.bringToFront();
                    circle10.bringToFront();
                }
                if (stateLayer) stateLayer.bringToBack();
            }

            function getHeatMapStyle(feature)
            {
                if (layersVisible.heatmap)
                {
                    const density = feature.properties._density || 0;
                    const max = feature.properties._maxDensity || 1;
                    const d = density / max;
                    return {
                        fillColor: d > 0.8 ? '#800026' : d > 0.6 ? '#E31A1C' : d > 0.4 ? '#FC4E2A' : d > 0.2 ? '#FEB24C' : d > 0.1 ? '#ADD8E6' : '#E0F2F1',
                        weight: 0.5, opacity: 1, color: 'white', dashArray: '', fillOpacity: 0.6
                    };
                } else
                {
                    return { color: '#64748b', weight: 0.5, fillColor: '#3b82f6', fillOpacity: 0.1 };
                }
            }

            const els = {
                t1: document.getElementById('val-t1'),
                t2: document.getElementById('val-t2'),
                t3: document.getElementById('val-t3'),
                rateT1: document.getElementById('rate-t1'),
                rateT2: document.getElementById('rate-t2'),
                rateT3: document.getElementById('rate-t3'),
                vicT1: document.getElementById('victims-t1'),
                vicT2: document.getElementById('victims-t2'),
                vicT3: document.getElementById('victims-t3'),
                totalVictims: document.getElementById('total-gamblers'),
                valPop: document.getElementById('disp-pop-impact-zones'),
                inputRate: document.getElementById('input-rate'),
                map: document.getElementById(elementId),
                countySelect: document.getElementById('input-county'),
                displayCounty: document.getElementById('display-impact-county')
            };

            if (!els.map) return;

            // 2. Initialize Map
            const map = L.map(elementId, {
                scrollWheelZoom: false, attributionControl: false, zoomControl: false
            }).setView([39.8, -86.15], 7);

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // Zoom Hint Logic
            const zoomHint = document.getElementById('map-zoom-hint');
            const mapContainer = els.map.parentElement;
            let hintTimeout;
            function showHint()
            {
                if (document.fullscreenElement) return;
                zoomHint.style.opacity = '1';
                clearTimeout(hintTimeout);
                hintTimeout = setTimeout(() => { zoomHint.style.opacity = '0'; }, 2000);
            }
            const onWheel = (e) =>
            {
                if (document.fullscreenElement)
                {
                    map.scrollWheelZoom.enable(); zoomHint.style.opacity = '0'; return;
                }
                if (e.ctrlKey)
                {
                    map.scrollWheelZoom.enable(); zoomHint.style.opacity = '0';
                } else
                {
                    map.scrollWheelZoom.disable();
                    if (Math.abs(e.deltaY) > 2) showHint();
                }
            };
            const observer = new IntersectionObserver((entries) =>
            {
                entries.forEach(entry =>
                {
                    if (entry.isIntersecting) mapContainer.addEventListener('wheel', onWheel, { passive: true });
                    else
                    {
                        mapContainer.removeEventListener('wheel', onWheel);
                        map.scrollWheelZoom.disable();
                        if (zoomHint) zoomHint.style.opacity = '0';
                    }
                });
            }, { threshold: 0.1 });
            const section = document.getElementById('economic-analysis');
            if (section) observer.observe(section);

            mapContainer.addEventListener('mouseleave', () => { if (zoomHint) zoomHint.style.opacity = '0'; });
            window.addEventListener('blur', () => { map.scrollWheelZoom.disable(); });

            // Layers
            satelliteTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
            streetTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' });
            satelliteTileLayer.addTo(map);

            initStateMap();

            async function initStateMap()
            {
                try
                {
                    const res = await fetch('./data/indiana_counties_merged.json');
                    stateData = await res.json();
                    stateLayer = L.geoJSON(stateData, {
                        style: { color: '#94a3b8', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.1 },
                        interactive: true,
                        onEachFeature: (feature, layer) =>
                        {
                            if (feature.properties && feature.properties.NAME)
                            {
                                const tooltipContent = `<div class="bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-lg shadow-xl border border-slate-700 p-2 font-bold shadow-2xl">${feature.properties.NAME}</div>`;
                                layer.bindTooltip(tooltipContent, { sticky: true, className: 'map-tooltip', direction: 'top', offset: [0, -10], opacity: 1 });
                            }
                            layer.on({
                                mouseover: (e) =>
                                {
                                    e.target.setStyle({ weight: 2, color: '#60a5fa', fillOpacity: 0.3 });
                                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
                                },
                                mouseout: (e) => { stateLayer.resetStyle(e.target); },
                                click: (e) =>
                                {
                                    const countyId = feature.properties.COUNTY;
                                    if (countyId)
                                    {
                                        const cInfo = getCountyReference().find(c => c.id === countyId);
                                        if (cInfo)
                                        {
                                            loadCounty(countyId);
                                            window.dispatchEvent(new CustomEvent('county-selected-map', { detail: { name: cInfo.name, pop: cInfo.pop } }));
                                        }
                                    }
                                }
                            });
                        }
                    }).addTo(map);
                } catch (e)
                {
                    console.error("State Map Load Error", e);
                }
            }

            // Marker
            const center = [41.0793, -85.1394];
            const casinoPin = L.icon({
                iconUrl: 'assets/Casino_Map_Marker.svg',
                iconSize: [50, 88],
                iconAnchor: [25, 88],
                popupAnchor: [0, -80],
                className: 'marker-shadow-filter'
            });
            const marker = L.marker(center, { draggable: true, autoPan: true, icon: casinoPin }).addTo(map);

            const circle20 = L.circle(center, { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.35, weight: 2, dashArray: '5, 5', radius: 32186.9 }).addTo(map);
            const circle10 = L.circle(center, { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.25, weight: 2, radius: 16093.4 }).addTo(map);

            // Controls
            const mapOverlayControls = L.control({ position: 'topright' });
            mapOverlayControls.onAdd = function (map)
            {
                const container = L.DomUtil.create('div', 'flex flex-col items-end gap-2 mt-4 mr-2');
                container.id = 'map-overlay-topright';
                const btn = L.DomUtil.create('button', 'bg-white text-slate-700 hover:bg-slate-100 w-10 h-10 flex items-center justify-center rounded-lg shadow-xl cursor-pointer border border-slate-300 transition-colors mb-2', container);
                btn.innerHTML = '<span class="material-symbols-outlined text-2xl leading-none">fullscreen</span>';
                btn.title = "Toggle Fullscreen";
                btn.id = "fs-toggle-btn";
                btn.onclick = function ()
                {
                    const mapEl = els.map.parentElement;
                    if (!document.fullscreenElement)
                    {
                        mapEl.requestFullscreen().catch(err => { console.log(`Error attempting to enable fullscreen: ${err.message}`); });
                    } else { document.exitFullscreen(); }
                };
                const labelStack = L.DomUtil.create('div', 'flex flex-col gap-2', container);
                labelStack.innerHTML = `
                    <div class="bg-blue-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105" id="label-high">High Risk: -</div>
                    <div class="bg-red-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105" id="label-elevated">Elevated Risk: -</div>
                    <div class="bg-orange-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105" id="label-baseline">Baseline: -</div>
                `;
                return container;
            };
            mapOverlayControls.addTo(map);

            document.addEventListener('fullscreenchange', () =>
            {
                const btn = document.getElementById('fs-toggle-btn');
                if (btn)
                {
                    if (document.fullscreenElement)
                    {
                        btn.innerHTML = '<span class="material-symbols-outlined text-2xl leading-none">fullscreen_exit</span>';
                        map.scrollWheelZoom.enable();
                    } else
                    {
                        btn.innerHTML = '<span class="material-symbols-outlined text-2xl leading-none">fullscreen</span>';
                        map.scrollWheelZoom.disable();
                    }
                }
            });

            async function loadCounty(countyId, skipMarkerMove = false)
            {
                if (!countyId) return;
                if (cache[countyId])
                {
                    currentGeoJSON = cache[countyId];
                    currentCountyId = countyId;
                    highlightCountyVisuals(countyId, skipMarkerMove);
                    calculateImpact();
                    return;
                }
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
                    calculateImpact();
                } catch (e) { console.error("Map Error:", e); }
            }

            function preprocessPopulation(geoJSON, countyId)
            {
                const countyInfo = getCountyReference().find(c => c.id === countyId);
                const totalPop = countyInfo ? countyInfo.pop : 0;
                let hasPopProp = false; let totalArea = 0;
                turf.featureEach(geoJSON, (feature) =>
                {
                    if (feature.properties.POPULATION !== undefined || feature.properties.POP !== undefined) hasPopProp = true;
                    totalArea += (feature.properties.ALAND || 0);
                });
                if (!hasPopProp && totalArea > 0)
                {
                    turf.featureEach(geoJSON, (feature) =>
                    {
                        const area = feature.properties.ALAND || 0;
                        const estimated = (area / totalArea) * totalPop;
                        feature.properties._estPop = estimated;
                    });
                }
            }

            function generateTractLayer(geoJSON)
            {
                if (!geoJSON) return null;
                try
                {
                    const clone = JSON.parse(JSON.stringify(geoJSON));
                    const dissolved = turf.dissolve(clone, { propertyName: 'TRACTCE' });
                    return L.geoJSON(dissolved, { style: { color: '#1e293b', weight: 2, fillOpacity: 0, dashArray: '2, 4' }, interactive: false });
                } catch (e) { console.error("Tract gen failed", e); return null; }
            }

            function highlightCountyVisuals(countyId, skipMarkerMove = false)
            {
                if (!stateData) return;
                const countyFeature = stateData.features.find(f => f.properties.COUNTY === countyId);
                if (highlightLayer) map.removeLayer(highlightLayer);
                if (countyFeature)
                {
                    highlightLayer = L.geoJSON(countyFeature, { style: { color: '#f97316', weight: 3, fillColor: '#7c2d12', fillOpacity: 0.2, dashArray: '4, 4' }, interactive: false });
                }
                if (blockGroupLayer) map.removeLayer(blockGroupLayer);
                if (tractLayer) map.removeLayer(tractLayer);
                if (currentGeoJSON)
                {
                    let maxDensity = 0;
                    let hasRealData = false;
                    turf.featureEach(currentGeoJSON, (f) => { if (f.properties.POPULATION || f.properties.POP) hasRealData = true; });
                    turf.featureEach(currentGeoJSON, (f) =>
                    {
                        const a = f.properties.ALAND || 0; let density = 0;
                        if (hasRealData) { const p = f.properties.POPULATION || f.properties.POP || 0; density = a > 0 ? p / a : 0; }
                        else { density = a > 0 ? 1 / a : 0; }
                        f.properties._density = density;
                        if (density > maxDensity) maxDensity = density;
                    });
                    turf.featureEach(currentGeoJSON, (f) => { f.properties._maxDensity = maxDensity; });
                    blockGroupLayer = L.geoJSON(currentGeoJSON, { style: getHeatMapStyle, interactive: false });
                    tractLayer = generateTractLayer(currentGeoJSON);
                }
                if (countyFeature && !skipMarkerMove)
                {
                    const bounds = L.geoJSON(countyFeature).getBounds();
                    map.fitBounds(bounds, { padding: [50, 50] });
                    const latLng = bounds.getCenter();
                    marker.setLatLng(latLng); circle10.setLatLng(latLng); circle20.setLatLng(latLng);
                }
                updateLayerVisibility();
                calculateImpact();
                const cInfo = getCountyReference().find(c => c.id === countyId);
                if (els.displayCounty && cInfo) els.displayCounty.textContent = cInfo.name;
            }

            const geocoder = L.Control.geocoder({
                defaultMarkGeocode: false, collapsed: false, placeholder: "Search for an address...", suggestMinLength: 3, suggestTimeout: 300,
                geocoder: L.Control.Geocoder.nominatim({ geocodingQueryParams: { countrycodes: 'us', viewbox: '-88.2,42.0,-84.6,37.5', bounded: 1, limit: 5 } })
            }).on('markgeocode', function (e)
            {
                const center = e.geocode.center;
                marker.setLatLng(center); circle10.setLatLng(center); circle20.setLatLng(center);
                map.setView(center, 11);
                calculateImpact();
            }).addTo(map);

            const searchContainer = document.getElementById('map-search-container');
            const geocoderNode = geocoder.getContainer();
            if (searchContainer && geocoderNode)
            {
                searchContainer.appendChild(geocoderNode);
                const input = geocoderNode.querySelector('input');
                let debounceTimer;
                if (input)
                {
                    input.addEventListener('input', function (e)
                    {
                        clearTimeout(debounceTimer);
                        const val = this.value;
                        if (val.length >= 3)
                        {
                            debounceTimer = setTimeout(() => { if (geocoder._geocode) geocoder._geocode(); }, 500);
                        }
                    });
                }
            }

            function calculateImpact()
            {
                if (!currentGeoJSON) return;
                const baselineRate = parseFloat(els.inputRate ? els.inputRate.value : 2.3);
                const markerLatLng = marker.getLatLng();
                const centerPoint = turf.point([markerLatLng.lng, markerLatLng.lat]);
                let t1Pop = 0; let t2Pop = 0; let t3Pop = 0;
                const countyInfo = getCountyReference().find(c => c.id === currentCountyId);
                const totalCountyPop = countyInfo ? countyInfo.pop : 0;
                turf.featureEach(currentGeoJSON, (feature) =>
                {
                    const pop = feature.properties.POPULATION || feature.properties.POP || feature.properties._estPop || 0;
                    let centroid = null;
                    try { centroid = turf.centroid(feature); } catch (e) { return; }
                    const distance = turf.distance(centerPoint, centroid, { units: 'miles' });
                    if (distance <= 10) t1Pop += pop; else if (distance <= 20) t2Pop += pop;
                });
                t3Pop = Math.max(0, totalCountyPop - t1Pop - t2Pop);
                const r1 = baselineRate * 2.0; const r2 = baselineRate * 1.5; const r3 = baselineRate * 1.0;
                const v1 = t1Pop * (r1 / 100); const v2 = t2Pop * (r2 / 100); const v3 = t3Pop * (r3 / 100);
                const totalVictims = v1 + v2 + v3;
                animateValue(els.t1, t1Pop); animateValue(els.t2, t2Pop);
                const labelT3 = document.getElementById('label-t3');
                if (t3Pop === 0 && totalCountyPop > 0)
                {
                    els.t3.textContent = "Fully Captured";
                    els.t3.classList.remove('text-xl', 'font-black', 'text-white', 'mb-1'); els.t3.classList.add('text-xs', 'font-bold', 'text-white', 'uppercase');
                    if (labelT3) labelT3.textContent = "by Preceding Impact Zones";
                } else
                {
                    animateValue(els.t3, t3Pop);
                    els.t3.classList.add('text-xl', 'font-black', 'text-white', 'mb-1'); els.t3.classList.remove('text-xs', 'font-bold', 'uppercase');
                    if (labelT3) labelT3.textContent = "Population";
                }
                if (els.rateT1) els.rateT1.textContent = r1.toFixed(1) + '%';
                if (els.rateT2) els.rateT2.textContent = r2.toFixed(1) + '%';
                if (els.rateT3) els.rateT3.textContent = r3.toFixed(1) + '%';
                if (els.vicT1) els.vicT1.textContent = Math.round(v1).toLocaleString();
                if (els.vicT2) els.vicT2.textContent = Math.round(v2).toLocaleString();
                if (els.vicT3) els.vicT3.textContent = Math.round(v3).toLocaleString();
                if (els.totalVictims) els.totalVictims.textContent = Math.round(totalVictims).toLocaleString();
                const lblHigh = document.getElementById('label-high');
                const lblElevated = document.getElementById('label-elevated');
                const lblBaseline = document.getElementById('label-baseline');
                if (lblHigh) lblHigh.textContent = `High Risk: ${Math.round(t1Pop).toLocaleString()}`;
                if (lblElevated) lblElevated.textContent = `Elevated Risk: ${Math.round(t2Pop).toLocaleString()}`;
                if (lblBaseline) lblBaseline.textContent = `Baseline: ${Math.round(t3Pop).toLocaleString()}`;
                const calcRes = document.getElementById('calc-result');
                const calcGamblers = document.getElementById('calc-gamblers');
                if (calcRes) calcRes.textContent = Math.round(totalVictims).toLocaleString();
                if (calcGamblers) calcGamblers.textContent = Math.round(totalVictims).toLocaleString();
                const dispPop = document.getElementById('disp-pop-impact-zones');
                const dispRate = document.getElementById('disp-effective-rate');
                if (dispPop) dispPop.textContent = totalCountyPop.toLocaleString();
                if (dispRate)
                {
                    const effectiveRate = totalCountyPop > 0 ? (totalVictims / totalCountyPop) * 100 : 0;
                    dispRate.textContent = effectiveRate.toFixed(2) + '%';
                }
                const triggerInput = document.getElementById('input-revenue');
                if (triggerInput) triggerInput.dispatchEvent(new Event('input'));
            }

            function animateValue(el, val) { if (!el) return; el.textContent = Math.round(val).toLocaleString(); }

            marker.on('drag', () =>
            {
                const pos = marker.getLatLng();
                circle10.setLatLng(pos); circle20.setLatLng(pos);
                if (stateData)
                {
                    const pt = turf.point([pos.lng, pos.lat]);
                    const matched = stateData.features.find(f => turf.booleanPointInPolygon(pt, f));
                    if (matched)
                    {
                        const newCountyId = matched.properties.COUNTY;
                        if (newCountyId !== currentCountyId)
                        {
                            currentCountyId = newCountyId;
                            loadCounty(newCountyId, true);
                            const cInfo = getCountyReference().find(c => c.id === newCountyId);
                            if (cInfo) window.dispatchEvent(new CustomEvent('county-selected-map', { detail: { name: cInfo.name, pop: cInfo.pop } }));
                        }
                    }
                }
                calculateImpact();
            });

            if (els.inputRate)
            {
                els.inputRate.addEventListener('input', () => { calculateImpact(); });
            }
            if (els.countySelect)
            {
                els.countySelect.addEventListener('change', (e) =>
                {
                    const val = els.countySelect.value;
                    let found = getCountyReference().find(c => c.id === val);
                    if (!found) found = getCountyReference().find(c => c.pop == val);
                    if (found) { currentCountyId = found.id; loadCounty(found.id); }
                });
            }

            const repGeoc = L.Control.geocoder({
                defaultMarkGeocode: false, collapsed: false, placeholder: "Enter address (e.g., 123 Main St, Fort Wayne)",
                suggestMinLength: 3, suggestTimeout: 300, geocoder: L.Control.Geocoder.photon({})
            }).on('markgeocode', function (e)
            {
                const input = repGeoc.getContainer().querySelector('input');
                let fullAddress = e.geocode.name;
                if (input)
                {
                    const typed = input.value;
                    const numberMatch = typed.match(/^(\d+)\s/);
                    if (numberMatch && !fullAddress.startsWith(numberMatch[1])) fullAddress = numberMatch[1] + " " + fullAddress;
                    input.value = fullAddress;
                }
                const statusEl = document.getElementById('rep-search-status');
                const resultsEl = document.getElementById('rep-results');
                if (resultsEl) resultsEl.classList.remove('hidden');
                if (statusEl) { statusEl.textContent = "Locating districts for: " + fullAddress; statusEl.classList.remove('text-red-500'); }

                const callbackName = 'census_cb_' + Math.floor(Math.random() * 1000000);
                window[callbackName] = function (data)
                {
                    delete window[callbackName];
                    const scripts = document.querySelectorAll('script[data-census]');
                    scripts.forEach(s => s.remove());
                    try
                    {
                        if (!data.result || !data.result.addressMatches || data.result.addressMatches.length === 0) throw new Error("Address not found in Census database.");
                        const match = data.result.addressMatches[0];
                        const geographies = match.geographies;
                        if (!geographies) throw new Error("District data not available for this location.");
                        let senateDist = null; let houseDist = null;
                        Object.keys(geographies).forEach(key =>
                        {
                            if (key.includes('Legislative Districts - Upper')) senateDist = geographies[key][0]?.BASENAME;
                            if (key.includes('Legislative Districts - Lower')) houseDist = geographies[key][0]?.BASENAME;
                        });
                        if (!senateDist || !houseDist) throw new Error("Address is outside Indiana legislative districts.");
                        if (window.updateRepCard)
                        {
                            window.updateRepCard('senate', senateDist); window.updateRepCard('house', houseDist);
                            if (resultsEl) resultsEl.classList.remove('hidden');
                            if (statusEl) statusEl.textContent = "";
                        }
                    } catch (err)
                    {
                        if (statusEl) { statusEl.textContent = "Error: " + err.message; statusEl.classList.add('text-red-500'); }
                    }
                };
                const script = document.createElement('script');
                script.setAttribute('data-census', 'true');
                const encodedAddr = encodeURIComponent(fullAddress);
                script.src = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodedAddr}&benchmark=Public_AR_Current&vintage=Census2020_Current&format=jsonp&callback=${callbackName}`;
                document.body.appendChild(script);
            }).addTo(map);

            const repGeocContainer = document.getElementById('rep-geocoder-container');
            const repGeocNode = repGeoc.getContainer();
            if (repGeocContainer && repGeocNode)
            {
                repGeocContainer.appendChild(repGeocNode);
            }

            loadCounty("003");
        }
    };
})();

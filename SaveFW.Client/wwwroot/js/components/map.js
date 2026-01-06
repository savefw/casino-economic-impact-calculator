window.ImpactMap = (function ()
{

    // --- SHARED DATA & STATE ---
    const getCountyReference = () => window.CurrentCountyList || [];

    const cache = {};

    return {
        init: function (elementId)
        {
            let currentGeoJSON = null;
            let currentStateFips = null;
            let currentCountyFips = null;
            let stateLayer = null;
            let countyLayer = null;
            let highlightLayer = null;
            let blockGroupLayer = null;
            let tractLayer = null;
            let stateData = null;
            let countyData = null;
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
                    if (circle10 && !map.hasLayer(circle10)) map.addLayer(circle10);
                    if (circle20 && !map.hasLayer(circle20)) map.addLayer(circle20);
                } else
                {
                    if (circle10 && map.hasLayer(circle10)) map.removeLayer(circle10);
                    if (circle20 && map.hasLayer(circle20)) map.removeLayer(circle20);
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
                if (stateLayer || countyLayer)
                {
                    if (layersVisible.boundary)
                    {
                        if (stateLayer && !map.hasLayer(stateLayer)) map.addLayer(stateLayer);
                        if (countyLayer && !map.hasLayer(countyLayer)) map.addLayer(countyLayer);
                        if (stateLayer) stateLayer.bringToBack();
                    } else
                    {
                        if (stateLayer && map.hasLayer(stateLayer)) map.removeLayer(stateLayer);
                        if (countyLayer && map.hasLayer(countyLayer)) map.removeLayer(countyLayer);
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
                    if (circle20) circle20.bringToFront();
                    if (circle10) circle10.bringToFront();
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
                stateSelect: document.getElementById('input-state'),
                countySelect: document.getElementById('input-county'),
                displayCounty: document.getElementById('display-impact-county')
            };

            if (!els.map) return;

            // 2. Initialize Map
            const map = L.map(elementId, {
                scrollWheelZoom: false, attributionControl: false, zoomControl: false
            }).setView([39.5, -98.35], 4);

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

            // Fix for grey map tiles - invalidate size after container is fully rendered
            setTimeout(() =>
            {
                map.invalidateSize();
                map.setView([39.5, -98.35], 4);
            }, 100);
            setTimeout(() =>
            {
                map.invalidateSize();
            }, 500);

            initStateMap();

            async function initStateMap()
            {
                try
                {
                    const res = await fetch('/api/census/states');
                    const apiData = await res.json();
                    if (apiData && Array.isArray(apiData.features))
                    {
                        apiData.features.forEach(f =>
                        {
                            if (!f.properties) f.properties = {};
                            if (!f.properties.NAME) f.properties.NAME = f.properties.name || f.properties.NAME || "";
                            if (!f.properties.STUSPS) f.properties.STUSPS = f.properties.stusps || f.properties.STUSPS || "";
                            if (!f.properties.GEOID) f.properties.GEOID = f.properties.geoid || f.properties.GEOID || "";
                        });
                    }
                    stateData = apiData;
                    stateLayer = L.geoJSON(stateData, {
                        style: { color: '#94a3b8', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.05 },
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
                                    const stateFips = feature.properties.GEOID;
                                    if (stateFips)
                                    {
                                        loadStateCounties(stateFips);
                                    }
                                }
                            });
                        }
                    }).addTo(map);

                    if (els.stateSelect)
                    {
                        const options = apiData.features
                            .map(f => ({
                                geoid: f.properties.GEOID,
                                name: f.properties.NAME || f.properties.GEOID
                            }))
                            .sort((a, b) => a.name.localeCompare(b.name));
                        els.stateSelect.innerHTML = '<option value=\"\">Select a state</option>' +
                            options.map(s => `<option value=\"${s.geoid}\">${s.name}</option>`).join('');

                        els.stateSelect.onchange = () =>
                        {
                            const val = els.stateSelect.value;
                            if (val) loadStateCounties(val);
                        };
                    }
                } catch (e)
                {
                    console.error("State Map Load Error", e);
                }
            }

            async function loadStateCounties(stateFips)
            {
                toggleLoading(true);
                const textEl = document.getElementById('map-loading-text');
                if (textEl) textEl.textContent = "Loading County Boundaries...";
                try
                {
                    currentStateFips = stateFips;
                    if (els.stateSelect) els.stateSelect.value = stateFips;
                    const displayEl = document.getElementById('county-display');
                    if (displayEl) displayEl.textContent = "Select a county";
                    if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }
                    if (blockGroupLayer) { map.removeLayer(blockGroupLayer); blockGroupLayer = null; }
                    if (tractLayer) { map.removeLayer(tractLayer); tractLayer = null; }
                    if (marker) { map.removeLayer(marker); marker = null; }
                    if (circle10) { map.removeLayer(circle10); circle10 = null; }
                    if (circle20) { map.removeLayer(circle20); circle20 = null; }
                    currentContextGeoJSON = null;
                    const res = await fetch(`/api/census/counties/${stateFips}`);
                    const apiData = await res.json();
                    if (apiData && Array.isArray(apiData.features))
                    {
                        apiData.features.forEach(f =>
                        {
                            if (!f.properties) f.properties = {};
                            const geoid = f.properties.geoid || f.properties.GEOID || "";
                            if (!f.properties.NAME) f.properties.NAME = f.properties.name || f.properties.NAME || "";
                            if (!f.properties.COUNTY && geoid.length >= 5) f.properties.COUNTY = geoid.slice(-3);
                            if (!f.properties.GEOID) f.properties.GEOID = geoid;
                        });
                    }
                    countyData = apiData;
                    window.CurrentCountyList = (apiData && Array.isArray(apiData.features))
                        ? apiData.features.map(f => ({
                            id: (f.properties.GEOID || "").slice(-3),
                            geoid: f.properties.GEOID || "",
                            name: f.properties.NAME || "",
                            pop: 0
                        }))
                        : [];

                    if (countyLayer) map.removeLayer(countyLayer);
                    countyLayer = L.geoJSON(countyData, {
                        style: { color: '#94a3b8', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.08 },
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
                                mouseout: (e) => { countyLayer.resetStyle(e.target); },
                                click: () =>
                                {
                                    const geoid = feature.properties.GEOID;
                                    if (geoid)
                                    {
                                        loadCounty(geoid);
                                    }
                                }
                            });
                        }
                    }).addTo(map);

                    if (els.countySelect)
                    {
                        const opts = window.CurrentCountyList || [];
                        els.countySelect.innerHTML = '<option value="">Select County</option>' +
                            opts.map(c => `<option value="${c.geoid}">${c.name || c.geoid}</option>`).join('');
                    }

                    if (window.EconomicCalculator && window.EconomicCalculator.updateCounties)
                    {
                        window.EconomicCalculator.updateCounties();
                    }
                } catch (e)
                {
                    console.error("County Load Error", e);
                } finally
                {
                    if (textEl) textEl.textContent = "Loading Regional Data...";
                    toggleLoading(false);
                    updateLayerVisibility();
                }
            }

            // Marker (created on county selection)
            let marker = null;
            let circle20 = null;
            let circle10 = null;
            const casinoPin = L.icon({
                iconUrl: 'assets/Casino_Map_Marker.svg',
                iconSize: [50, 88],
                iconAnchor: [25, 88],
                popupAnchor: [0, -80],
                className: 'marker-shadow-filter'
            });

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

            // Loading Overlay
            function toggleLoading(show)
            {
                const mapEl = els.map;
                let overlay = document.getElementById('map-loading-overlay');
                if (!overlay && show)
                {
                    overlay = document.createElement('div');
                    overlay.id = 'map-loading-overlay';
                    overlay.className = 'absolute inset-0 z-[500] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300';
                    overlay.innerHTML = `
                        <div class="flex flex-col items-center gap-4">
                            <div class="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                            <div class="text-white font-bold text-shadow-sm" id="map-loading-text">Loading Regional Data...</div>
                        </div>
                    `;
                    mapEl.parentElement.appendChild(overlay);
                }
                if (overlay)
                {
                    overlay.style.opacity = show ? '1' : '0';
                    overlay.style.pointerEvents = show ? 'auto' : 'none';
                }
            }

            async function loadCounty(countyFips, skipMarkerMove = false)
            {
                if (!countyFips) return;

                // 1. Load Calculation Context (The 50 mile buffer data)
                const textEl = document.getElementById('map-loading-text');
                if (textEl) textEl.textContent = "Loading County Data...";
                await loadCountyContext(countyFips);

                // 2. Set Visuals using the loaded context data
                // We extract the county specific features from the context for visualization
                if (currentContextGeoJSON)
                {
                    currentCountyFips = countyFips;
                    highlightCountyVisuals(countyFips, currentContextGeoJSON, skipMarkerMove);
                }

                calculateImpact(); // Trigger calc after data load

                const cInfo = getCountyReference().find(c => c.geoid === currentCountyFips);
                if (cInfo)
                {
                    window.dispatchEvent(new CustomEvent('county-selected-map', { detail: { name: cInfo.name, pop: cInfo.pop || 0, geoid: currentCountyFips } }));
                }

                if (textEl) textEl.textContent = "Loading Regional Data...";
            }

            // ... (keep surrounding code) ...

            function highlightCountyVisuals(countyFips, contextData, skipMarkerMove = false)
            {
                if (!countyData) return;
                const countyFeature = countyData.features.find(f => f.properties.GEOID === countyFips);
                if (highlightLayer) map.removeLayer(highlightLayer);
                if (countyFeature)
                {
                    highlightLayer = L.geoJSON(countyFeature, { style: { color: '#f97316', weight: 3, fillColor: '#7c2d12', fillOpacity: 0.2, dashArray: '4, 4' }, interactive: false });
                }
                if (blockGroupLayer) map.removeLayer(blockGroupLayer);
                if (tractLayer) map.removeLayer(tractLayer);

                // Use the REAL Census Data from our Context (filtered to this county)
                if (contextData)
                {
                    // Filter features that belong to this county (FIPS match)
                    const countyFeatures = contextData.features.filter(f =>
                    {
                        const geoid = f.properties.GEOID || "";
                        return geoid.startsWith(countyFips);
                    });

                    const countyGeoJSON = { type: "FeatureCollection", features: countyFeatures };


                    // Heatmap Generation (Gradient / Radiating) via Leaflet.heat
                    const heatPoints = [];
                    let maxPop = 0;

                    turf.featureEach(countyGeoJSON, (f) =>
                    {
                        const p = f.properties.POP_ADULT || 0;
                        if (p > maxPop) maxPop = p;
                    });

                    // Avoid div by zero
                    if (maxPop === 0) maxPop = 1;

                    turf.featureEach(countyGeoJSON, (f) =>
                    {
                        const p = f.properties.POP_ADULT || 0;
                        if (p > 0)
                        {
                            const centroid = turf.centroid(f);
                            const lat = centroid.geometry.coordinates[1];
                            const lng = centroid.geometry.coordinates[0];
                            // Intensity:
                            // Leaflet.heat works best with values 0-1.
                            // We want areas with high pop to be 'hotter'.
                            const intensity = (p / maxPop);
                            heatPoints.push([lat, lng, intensity]);
                        }
                    });

                    // Remove old if exists
                    if (blockGroupLayer)
                    {
                        map.removeLayer(blockGroupLayer);
                        blockGroupLayer = null;
                    }

                    if (heatPoints.length > 0)
                    {
                        try
                        {
                            // Using a higher maxZoom and blur allows for a more continuous 'cloud'
                            blockGroupLayer = L.heatLayer(heatPoints, {
                                radius: 30, // Larger radius for more overlap/blend
                                blur: 20,   // High blur for 'radiating' look
                                maxZoom: 13,
                                max: 1.0,
                                gradient: { 0.2: 'blue', 0.4: 'lime', 0.6: 'yellow', 0.9: 'orange', 1.0: 'red' }
                            });
                        } catch (e)
                        {
                            console.warn("Leaflet.heat not loaded?", e);
                        }
                    }

                    // Generate Tracts from this same live data
                    tractLayer = generateTractLayer(countyGeoJSON);
                }

                if (countyFeature && !skipMarkerMove)
                {
                    const bounds = L.geoJSON(countyFeature).getBounds();
                    map.fitBounds(bounds, { padding: [50, 50] });
                    const latLng = bounds.getCenter();

                    if (!marker)
                    {
                        marker = L.marker(latLng, { draggable: true, autoPan: false, icon: casinoPin }).addTo(map);
                        circle20 = L.circle(latLng, { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.35, weight: 2, dashArray: '5, 5', radius: 32186.9 }).addTo(map);
                        circle10 = L.circle(latLng, { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.25, weight: 2, radius: 16093.4 }).addTo(map);

                        marker.on('drag', () =>
                        {
                            const pos = marker.getLatLng();
                            circle10.setLatLng(pos); circle20.setLatLng(pos);
                            if (countyData)
                            {
                                const pt = turf.point([pos.lng, pos.lat]);
                                const matched = countyData.features.find(f => turf.booleanPointInPolygon(pt, f));
                                if (matched)
                                {
                                    const newCountyFips = matched.properties.GEOID;
                                    if (newCountyFips && newCountyFips !== currentCountyFips)
                                    {
                                        currentCountyFips = newCountyFips;
                                        loadCounty(newCountyFips, true);
                                        const cInfo = getCountyReference().find(c => c.geoid === newCountyFips);
                                        if (cInfo) window.dispatchEvent(new CustomEvent('county-selected-map', { detail: { name: cInfo.name, pop: cInfo.pop } }));
                                    }
                                }
                            }
                            calculateImpact();
                        });
                    } else
                    {
                        marker.setLatLng(latLng); circle10.setLatLng(latLng); circle20.setLatLng(latLng);
                    }
                }
                updateLayerVisibility();
                const cInfo = getCountyReference().find(c => c.geoid === countyFips);
                if (els.displayCounty && cInfo) els.displayCounty.textContent = cInfo.name;
            }

            let currentContextGeoJSON = null;
            let contextCache = {};

            async function loadCountyContext(fips)
            {
                if (contextCache[fips])
                {
                    currentContextGeoJSON = contextCache[fips];
                    return;
                }
                toggleLoading(true);
                try
                {
                    // Use a slightly larger timeout or retry if needed, but PostGIS is fast
                    // Ensure FIPS is correct length. Client uses '003', server expects '18003' or handles it.
                    // We'll pass '003' and let server logic (added previously) handle prefix.
                    const res = await fetch(`/api/Impact/county-context/${fips}`);
                    if (!res.ok) throw new Error("Context fetch failed");
                    const data = await res.json();

                    // Pre-process for Turf if needed (ensure numeric props)
                    turf.featureEach(data, (f) =>
                    {
                        f.properties.POP_ADULT = Number(f.properties.POP_ADULT || 0);
                        f.properties.POPULATION = Number(f.properties.POPULATION || 0);
                    });

                    contextCache[fips] = data;
                    currentContextGeoJSON = data;
                } catch (e)
                {
                    console.error("Context Load Error", e);
                } finally
                {
                    toggleLoading(false);
                }
            }

            function preprocessPopulation(geoJSON, countyId)
            {
                // Legacy visual-only helper, kept for heatmap if needed on the visual layer
                // No changes needed, as highlightCountyVisuals uses `currentGeoJSON` (visual layer)
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

            const geocoder = L.Control.geocoder({
                defaultMarkGeocode: false, collapsed: false, placeholder: "Search for an address...", suggestMinLength: 3, suggestTimeout: 300,
                geocoder: L.Control.Geocoder.nominatim({ geocodingQueryParams: { countrycodes: 'us', viewbox: '-88.2,42.0,-84.6,37.5', bounded: 1, limit: 5 } })
            }).on('markgeocode', function (e)
            {
                const center = e.geocode.center;
                if (!marker)
                {
                    marker = L.marker(center, { draggable: true, autoPan: false, icon: casinoPin }).addTo(map);
                    circle20 = L.circle(center, { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.35, weight: 2, dashArray: '5, 5', radius: 32186.9 }).addTo(map);
                    circle10 = L.circle(center, { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.25, weight: 2, radius: 16093.4 }).addTo(map);
                } else
                {
                    marker.setLatLng(center); circle10.setLatLng(center); circle20.setLatLng(center);
                }
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
                // CLIENT SIDE ONLY - No Fetch
                if (!currentContextGeoJSON || !marker || !currentCountyFips) return;

                const baselineRate = parseFloat(els.inputRate ? els.inputRate.value : 2.3);
                const markerLatLng = marker.getLatLng();
                const centerPoint = turf.point([markerLatLng.lng, markerLatLng.lat]);

                // Get county info for context display
                const countyInfo = getCountyReference().find(c => c.geoid === currentCountyFips);

                // Sum county totals from context data (authoritative)
                let countyTotal = 0;
                let countyAdults = 0;

                let t1Pop = 0;
                let t2Pop = 0;

                // Iterate over the loaded 50-mile context
                turf.featureEach(currentContextGeoJSON, (feature) =>
                {
                    const props = feature.properties;
                    const popAdult = props.POP_ADULT || 0;
                    const popTotal = props.POPULATION || 0;

                    // Sum for County Adults (based on FIPS match)
                    const geoid = props.GEOID || "";
                    const isFeatureInCounty = geoid.startsWith(currentCountyFips);

                    if (isFeatureInCounty)
                    {
                        countyAdults += popAdult;
                        countyTotal += popTotal;
                    }

                    // Spatial Summation
                    // We use centroid distance for speed, or intersection area for precision?
                    // Previous client code used centroid.
                    // Server code used Intersection Area.
                    // Client Intersection Area with Turf is slow for many polygons.
                    // Let's use Centroid with a weighting factor or simple inclusion?
                    // "Block Groups" are small enough that Centroid is "Okay" for a drag UI, 
                    // BUT user noticed precision issues before.
                    // OPTIMIZATION: Only check distance to centroid first.

                    // Fast Centroid approach:
                    // Only accurate if block groups are small.
                    // Let's try to stick to the logic that worked well before but client side if possible.
                    // Actually, turf.distance is fast.

                    const centerOfFeat = turf.centroid(feature);
                    const dist = turf.distance(centerPoint, centerOfFeat, { units: 'miles' });

                    if (dist <= 10)
                    {
                        // STRICTLY COUNT COUNTY RESIDENTS ONLY
                        // This prevents "Effective Rate" > "Max Rate" by ensuring numerator doesn't include out-of-county spillover
                        if (isFeatureInCounty) t1Pop += popAdult;
                    } else if (dist <= 20)
                    {
                        if (isFeatureInCounty) t2Pop += popAdult;
                    }
                });

                // Baseline Adults
                let t3Pop = Math.max(0, countyAdults - t1Pop - t2Pop);

                const r1 = baselineRate * 2.0; const r2 = baselineRate * 1.5; const r3 = baselineRate * 1.0;
                const v1 = t1Pop * (r1 / 100); const v2 = t2Pop * (r2 / 100); const v3 = t3Pop * (r3 / 100);
                const totalVictims = v1 + v2 + v3;

                animateValue(els.t1, t1Pop); animateValue(els.t2, t2Pop);
                const labelT3 = document.getElementById('label-t3');
                if (t3Pop === 0 && countyAdults > 0)
                {
                    els.t3.textContent = "Fully Captured";
                    els.t3.classList.remove('text-xl', 'font-black', 'text-white', 'mb-1'); els.t3.classList.add('text-xs', 'font-bold', 'text-white', 'uppercase');
                    if (labelT3) labelT3.textContent = "by Preceding Impact Zones";
                } else
                {
                    animateValue(els.t3, t3Pop);
                    els.t3.classList.add('text-xl', 'font-black', 'text-white', 'mb-1'); els.t3.classList.remove('text-xs', 'font-bold', 'uppercase');
                    if (labelT3) labelT3.textContent = "Adult Population"; // More specific label
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
                const dispPopAdults = document.getElementById('disp-pop-adults');
                const dispRateAdult = document.getElementById('disp-rate-adult');
                const dispRateTotal = document.getElementById('disp-rate-total');

                // DISPLAY TOTAL POPULATION (ALL AGES)
                if (dispPop) dispPop.textContent = countyTotal.toLocaleString();
                // DISPLAY ADULT POPULATION (18+)
                if (dispPopAdults) dispPopAdults.textContent = countyAdults.toLocaleString();

                if (countyInfo)
                {
                    countyInfo.pop = countyTotal;
                    const displayEl = document.getElementById('county-display');
                    if (displayEl) displayEl.textContent = countyInfo.name ? `${countyInfo.name} (${countyTotal.toLocaleString()})` : countyTotal.toLocaleString();
                }

                if (dispRateAdult)
                {
                    // UPDATED: Calculate effective rate based on Adult Population (18+)
                    const effectiveRate = countyAdults > 0 ? (totalVictims / countyAdults) * 100 : 0;
                    dispRateAdult.textContent = effectiveRate.toFixed(2) + '%';
                }

                if (dispRateTotal)
                {
                    // UPDATED: Calculate effective rate based on Total Population (All Ages) as secondary metric
                    const effectiveRate = countyTotal > 0 ? (totalVictims / countyTotal) * 100 : 0;
                    dispRateTotal.textContent = effectiveRate.toFixed(2) + '%';
                }

                const triggerInput = document.getElementById('input-revenue');
                if (triggerInput) triggerInput.dispatchEvent(new Event('input'));
            }

            function animateValue(el, val) { if (!el) return; el.textContent = Math.round(val).toLocaleString(); }

            if (els.inputRate)
            {
                els.inputRate.addEventListener('input', () => { calculateImpact(); });
            }
            if (els.countySelect)
            {
                els.countySelect.addEventListener('change', (e) =>
                {
                    const val = els.countySelect.value;
                    const found = getCountyReference().find(c => c.geoid === val);
                    if (found) { currentCountyFips = found.geoid; loadCounty(found.geoid); }
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

        }
    };
})();

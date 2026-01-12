window.ImpactMap = (function ()
{

    // --- SHARED DATA & STATE ---
    const getCountyReference = () => window.CurrentCountyList || [];

    const cache = {};

    return {
	        init: function (elementId)
	        {
	            function normalizeCountyFips(value)
	            {
	                const s = String(value == null ? "" : value).trim();
	                if (!s) return "";
	                return /^\d+$/.test(s) ? s.padStart(5, '0') : s;
	            }

	            let currentGeoJSON = null;
	            let currentStateFips = null;
	            let currentCountyFips = null;
	            let stateLayer = null;
            let selectedStateLayer = null;
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
                    if (panel.classList.contains('translate-x-[120%]')) panel.classList.remove('translate-x-[120%]');
                    else panel.classList.add('translate-x-[120%]');
                }
            };

            window.toggleLayer = async function (id)
            {
                const cb = document.getElementById('layer-' + id);
                if (cb)
                {
                    layersVisible[id] = cb.checked;
                    if ((id === 'blocks' || id === 'heatmap' || id === 'tracts') && layersVisible[id])
                    {
                        await ensureContextLayers();
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
                    if (circle10 && !map.hasLayer(circle10)) map.addLayer(circle10);
                    if (circle20 && !map.hasLayer(circle20)) map.addLayer(circle20);
                    if (circle50 && !map.hasLayer(circle50)) map.addLayer(circle50);
                } else
                {
                    if (circle10 && map.hasLayer(circle10)) map.removeLayer(circle10);
                    if (circle20 && map.hasLayer(circle20)) map.removeLayer(circle20);
                    if (circle50 && map.hasLayer(circle50)) map.removeLayer(circle50);
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
                if (stateLayer || countyLayer || selectedStateLayer)
                {
                    if (layersVisible.boundary)
                    {
                        if (stateLayer && !map.hasLayer(stateLayer)) map.addLayer(stateLayer);
                        if (countyLayer && !map.hasLayer(countyLayer)) map.addLayer(countyLayer);
                        if (selectedStateLayer && !map.hasLayer(selectedStateLayer)) map.addLayer(selectedStateLayer);
                        if (stateLayer) stateLayer.bringToBack();
                    } else
                    {
                        if (stateLayer && map.hasLayer(stateLayer)) map.removeLayer(stateLayer);
                        if (countyLayer && map.hasLayer(countyLayer)) map.removeLayer(countyLayer);
                        if (selectedStateLayer && map.hasLayer(selectedStateLayer)) map.removeLayer(selectedStateLayer);
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
	                    if (circle50) { circle50.bringToBack(); }
	                    if (circle20) { circle20.bringToBack(); }
	                    if (circle10) { circle10.bringToBack(); }
	                }
	                if (tractLayer && layersVisible.tracts) tractLayer.bringToFront();
	                if (highlightLayer && layersVisible.overlay) highlightLayer.bringToFront();
	                if (stateLayer) stateLayer.bringToBack();
                    if (countyLayer) countyLayer.bringToFront();
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
                stateTrigger: document.getElementById('state-trigger'),
                stateMenu: document.getElementById('state-menu'),
                stateOptions: document.getElementById('state-options'),
                stateSearch: document.getElementById('state-search'),
                stateSortAlpha: document.getElementById('state-sort-alpha'),
                stateSortPop: document.getElementById('state-sort-pop'),
                stateDisplay: document.getElementById('state-display'),
                countySelect: document.getElementById('input-county'),
                displayCounty: document.getElementById('display-impact-county')
            };

            if (!els.map) return;

            function resetImpactStats()
            {
                // Map Layers
                if (marker) { map.removeLayer(marker); marker = null; }
                if (circle10) { map.removeLayer(circle10); circle10 = null; }
                if (circle20) { map.removeLayer(circle20); circle20 = null; }
                if (circle50) { map.removeLayer(circle50); circle50 = null; }
                if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }
                if (blockGroupLayer) { map.removeLayer(blockGroupLayer); blockGroupLayer = null; }
                if (tractLayer) { map.removeLayer(tractLayer); tractLayer = null; }

                // Data Objects
                currentContextGeoJSON = null;
                currentCalcFeatures = null;
                currentCountyTotals = null;

                // UI Stats - Impact Zones
                if (els.t1) els.t1.textContent = "0";
                if (els.t2) els.t2.textContent = "0";
                if (els.t3)
                {
                    els.t3.textContent = "0";
                    els.t3.classList.remove('text-xl', 'font-black', 'text-white', 'mb-1');
                    els.t3.classList.add('text-xs', 'font-bold', 'uppercase');
                }
                const labelT3 = document.getElementById('label-t3');
                if (labelT3) labelT3.textContent = "Baseline (20-50 mi)";

                // UI Stats - Risk Levels Labels
                const lblHigh = document.getElementById('label-high');
                const lblElevated = document.getElementById('label-elevated');
                const lblBaseline = document.getElementById('label-baseline');
                if (lblHigh) lblHigh.textContent = "High Risk: -";
                if (lblElevated) lblElevated.textContent = "Elevated Risk: -";
                if (lblBaseline) lblBaseline.textContent = "Baseline: -";

                // UI Stats - Table Values
                const idsToZero = [
                    'val-t1-county', 'val-t1-other',
                    'val-t2-county', 'val-t2-other',
                    'val-t3-county', 'val-t3-other',
                    'victims-t1-county', 'victims-t1-other',
                    'victims-t2-county', 'victims-t2-other',
                    'victims-t3-county', 'victims-t3-other',
                    'net-new-t1', 'net-new-t1-county', 'net-new-t1-other',
                    'net-new-t2', 'net-new-t2-county', 'net-new-t2-other',
                    'net-new-t3', 'net-new-t3-county', 'net-new-t3-other',
                    'calc-result', 'calc-gamblers',
                    'disp-pop-impact-zones', 'disp-pop-adults',
                    'disp-pop-regional-50', 'disp-victims-regional-50',
                    'disp-victims-regional-other', 'disp-regional-counties'
                ];
                idsToZero.forEach(id =>
                {
                    const el = document.getElementById(id);
                    if (el) el.textContent = "0";
                });

                // UI Stats - Rates & Totals
                if (els.rateT1) els.rateT1.textContent = "0%";
                if (els.rateT2) els.rateT2.textContent = "0%";
                if (els.rateT3) els.rateT3.textContent = "0%";
                if (els.vicT1) els.vicT1.textContent = "0";
                if (els.vicT2) els.vicT2.textContent = "0";
                if (els.vicT3) els.vicT3.textContent = "0";
                if (els.totalVictims) els.totalVictims.textContent = "0";

                const dispRateAdult = document.getElementById('disp-rate-adult');
                if (dispRateAdult) dispRateAdult.textContent = "0%";
                const dispRateTotal = document.getElementById('disp-rate-total');
                if (dispRateTotal) dispRateTotal.textContent = "0%";
                const dispRegionalCounties20 = document.getElementById('disp-regional-counties-20');
                if (dispRegionalCounties20) dispRegionalCounties20.textContent = "≤20 mi: 0";

                // Dispatch Reset Event for other components (e.g. Calculator) to react
                window.dispatchEvent(new Event('map-state-reset'));
            }

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

            let stateMenuOpen = false;

            function updateMapNavUI(step)
            {
                const colors = {
                    1: { bar: 'bg-blue-500', shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]', text: 'text-blue-400' },
                    2: { bar: 'bg-emerald-500', shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]', text: 'text-emerald-400' },
                    3: { bar: 'bg-purple-500', shadow: 'shadow-[0_0_10px_rgba(168,85,247,0.5)]', text: 'text-purple-400' }
                };

                for (let i = 1; i <= 3; i++)
                {
                    const bar = document.getElementById(`map-nav-bar-${i}`);
                    const label = document.getElementById(`map-nav-label-${i}`);
                    if (!bar || !label) continue;

                    const config = colors[i];

                    // Reset classes
                    bar.classList.remove('bg-slate-700', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500',
                        'shadow-[0_0_10px_rgba(59,130,246,0.5)]',
                        'shadow-[0_0_10px_rgba(16,185,129,0.5)]',
                        'shadow-[0_0_10px_rgba(168,85,247,0.5)]');
                    label.classList.remove('text-slate-600', 'text-blue-400', 'text-emerald-400', 'text-purple-400');

                    if (i <= step)
                    {
                        bar.classList.add(config.bar, config.shadow);
                        label.classList.add(config.text);
                    } else
                    {
                        bar.classList.add('bg-slate-700');
                        label.classList.add('text-slate-600');
                    }
                }
            }

            function navigateToStep(step)
            {
                if (step === 1)
                {
                    // Back to Nationwide
                    currentStateFips = null;
                    currentCountyFips = null;
                    if (els.stateSelect) els.stateSelect.value = "";
                    if (els.stateDisplay) els.stateDisplay.textContent = "Select a state";
                    if (els.countySelect) els.countySelect.innerHTML = '<option value="">Select a state first</option>';
                    if (els.displayCounty) els.displayCounty.textContent = "Select a county";
                    
                    resetImpactStats();
                    if (countyLayer) { map.removeLayer(countyLayer); countyLayer = null; }
                    if (selectedStateLayer) { map.removeLayer(selectedStateLayer); selectedStateLayer = null; }
                    
                    if (stateData)
                    {
                        if (stateLayer && map.hasLayer(stateLayer)) map.removeLayer(stateLayer);
                        stateLayer = L.geoJSON(stateData, {
                            style: { color: '#94a3b8', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.05 },
                            interactive: true,
                            onEachFeature: (feature, layer) => {
                                // Re-bind events since we re-created the layer
                                layer.on({
                                    mouseover: (e) => { e.target.setStyle({ weight: 2, color: '#60a5fa', fillOpacity: 0.3 }); },
                                    mouseout: (e) => { stateLayer.resetStyle(e.target); },
                                    click: (e) => { 
                                        const fips = String(feature.properties.GEOID || feature.properties.geoid || "").padStart(2, '0');
                                        if (fips) loadStateCounties(fips);
                                    }
                                });
                            }
                        }).addTo(map);
                        map.setView([39.5, -98.35], 4);
                    }
                    updateMapNavUI(1);
                }
                else if (step === 2)
                {
                    // Back to State View
                    if (currentStateFips) loadStateCounties(currentStateFips);
                }
            }

            function toggleStateMenu(show)
            {
                if (!els.stateMenu) return;
                stateMenuOpen = show;
                if (show)
                {
                    els.stateMenu.classList.remove('hidden');
                    requestAnimationFrame(() =>
                    {
                        els.stateMenu.classList.remove('opacity-0', 'scale-95');
                        els.stateMenu.classList.add('opacity-100', 'scale-100');
                    });
                } else
                {
                    els.stateMenu.classList.remove('opacity-100', 'scale-100');
                    els.stateMenu.classList.add('opacity-0', 'scale-95');
                    setTimeout(() => { els.stateMenu.classList.add('hidden'); }, 200);
                }
            }

            function renderStateOptions(data)
            {
                if (!els.stateOptions) return;
                els.stateOptions.innerHTML = '';

                if (data.length === 0)
                {
                    els.stateOptions.innerHTML = `<div class="p-4 text-center text-sm text-slate-400">No states found.</div>`;
                    return;
                }

                const sorted = [...data].sort((a, b) =>
                {
                    if (stateSortMode === 'pop') {
                         return stateSortDir === 'asc' ? (a.pop || 0) - (b.pop || 0) : (b.pop || 0) - (a.pop || 0);
                    }
                    // Alpha
                    return stateSortDir === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '');
                });

                sorted.forEach(s =>
                {
                    const div = document.createElement('div');
                    div.className = "px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 hover:text-blue-300 cursor-pointer transition-colors flex items-center justify-between group";
                    div.innerHTML = `
                        <span class="font-medium">${s.name}</span>
                        <span class="text-xs text-white font-mono bg-[#0f172a] dark:bg-[#0f172a] px-2 py-0.5 rounded transition-colors">${s.pop > 0 ? s.pop.toLocaleString() : 'N/A'}</span>
                    `;
                    div.onclick = () =>
                    {
                        if (els.stateSelect) els.stateSelect.value = s.geoid;
                        if (els.stateDisplay) els.stateDisplay.textContent = s.name;
                        loadStateCounties(s.geoid);
                        toggleStateMenu(false);
                    };
                    els.stateOptions.appendChild(div);
                });
            }

            let stateSortMode = 'alpha';
            let stateSortDir = 'asc';
            let allStateOptions = [];

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
                            const rawGeoid = f.properties.geoid || f.properties.GEOID || "";
                            f.properties.GEOID = String(rawGeoid).padStart(2, '0');
                            if (!f.properties.POP_TOTAL) f.properties.POP_TOTAL = f.properties.pop_total || 0;
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
                                mouseout: (e) => { if (stateLayer) stateLayer.resetStyle(e.target); },
                                click: (e) =>
                                {
                                    const stateFips = String(feature.properties.GEOID || feature.properties.geoid || "").padStart(2, '0');
                                    if (stateFips)
                                    {
                                        loadStateCounties(stateFips);
                                    }
                                }
                            });
                        }
                    }).addTo(map);

                    if (apiData && Array.isArray(apiData.features))
                    {
                        allStateOptions = apiData.features.map(f => ({
                            geoid: f.properties.GEOID,
                            name: f.properties.NAME || f.properties.GEOID,
                            pop: f.properties.POP_TOTAL || 0
                        }));
                    }

                    if (els.stateSelect)
                    {
                        const options = allStateOptions.sort((a, b) => a.name.localeCompare(b.name));
                        els.stateSelect.innerHTML = '<option value=\"\">Select a state</option>' +
                            options.map(s => `<option value=\"${s.geoid}\">${s.name}</option>`).join('');

                        els.stateSelect.onchange = () =>
                        {
                            const val = els.stateSelect.value;
                            if (val) loadStateCounties(val);
                        };

                        renderStateOptions(allStateOptions);
                    }

                    if (els.stateSearch)
                    {
                        els.stateSearch.oninput = (e) =>
                        {
                            const term = e.target.value.toLowerCase();
                            const filtered = allStateOptions.filter(s => s.name.toLowerCase().includes(term));
                            renderStateOptions(filtered);
                        };
                    }

                    if (els.stateSortAlpha)
                    {
                        els.stateSortAlpha.onclick = (e) =>
                        {
                            e.preventDefault();
                            if (stateSortMode === 'alpha') {
                                stateSortDir = stateSortDir === 'asc' ? 'desc' : 'asc';
                            } else {
                                stateSortMode = 'alpha';
                                stateSortDir = 'asc';
                            }
                            renderStateOptions(allStateOptions);
                        };
                    }

                    if (els.stateSortPop)
                    {
                        els.stateSortPop.onclick = (e) =>
                        {
                            e.preventDefault();
                            if (stateSortMode === 'pop') {
                                stateSortDir = stateSortDir === 'asc' ? 'desc' : 'asc';
                            } else {
                                stateSortMode = 'pop';
                                stateSortDir = 'desc';
                            }
                            renderStateOptions(allStateOptions);
                        };
                    }

                    if (els.stateTrigger)
                    {
                        els.stateTrigger.onclick = (e) =>
                        {
                            e.preventDefault();
                            toggleStateMenu(!stateMenuOpen);
                        };
                    }

                    document.addEventListener('click', (e) =>
                    {
                        if (els.stateTrigger && els.stateMenu &&
                            !els.stateTrigger.contains(e.target) && !els.stateMenu.contains(e.target) && stateMenuOpen)
                        {
                            toggleStateMenu(false);
                        }
                    });
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
                    const normalizedFips = String(stateFips).padStart(2, '0');
                    currentStateFips = normalizedFips;
                    if (els.stateSelect) els.stateSelect.value = normalizedFips;
                    if (els.stateDisplay && stateData)
                    {
                        const stateFeature = stateData.features.find(f => f.properties.GEOID === normalizedFips);
                        if (stateFeature) els.stateDisplay.textContent = stateFeature.properties.NAME || normalizedFips;
                    }
                    const displayEl = document.getElementById('county-display');
                    if (displayEl) displayEl.textContent = "Select a county";
                    resetImpactStats();
                    if (stateData)
                    {
                        const stateFeature = stateData.features.find(f => f.properties.GEOID === normalizedFips);
                        if (stateFeature)
                        {
                            const bounds = L.geoJSON(stateFeature).getBounds();
                            map.fitBounds(bounds, { padding: [40, 40] });
                        }
                    }
                    if (stateLayer && map.hasLayer(stateLayer)) map.removeLayer(stateLayer);
                    stateLayer = null;
                    if (selectedStateLayer && map.hasLayer(selectedStateLayer)) map.removeLayer(selectedStateLayer);
                    if (stateData)
                    {
                        const stateFeature = stateData.features.find(f => f.properties.GEOID === normalizedFips);
                        if (stateFeature)
                        {
                            selectedStateLayer = L.geoJSON(stateFeature, {
                                style: { color: '#64748b', weight: 2, fillOpacity: 0 },
                                interactive: false
                            }).addTo(map);
                        }
                    }
                    const res = await fetch(`/api/census/counties/${normalizedFips}`);
                    const apiData = await res.json();
	                    if (apiData && Array.isArray(apiData.features))
	                    {
	                        apiData.features.forEach(f =>
	                        {
	                            if (!f.properties) f.properties = {};
	                            const geoid = normalizeCountyFips(f.properties.geoid || f.properties.GEOID || "");
	                            if (!f.properties.NAME) f.properties.NAME = f.properties.name || f.properties.NAME || "";
	                            if (!f.properties.COUNTY && geoid.length >= 5) f.properties.COUNTY = geoid.slice(-3);
	                            f.properties.GEOID = geoid;
	                            if (!f.properties.POP_TOTAL) f.properties.POP_TOTAL = f.properties.pop_total || 0;
	                        });
	                    }
                    countyData = apiData;
                    window.CurrentCountyList = (apiData && Array.isArray(apiData.features))
                        ? apiData.features.map(f => ({
                            id: (f.properties.GEOID || "").slice(-3),
                            geoid: f.properties.GEOID || "",
                            name: f.properties.NAME || "",
                            pop: f.properties.POP_TOTAL || 0
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
                    countyLayer.bringToFront();

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
                    updateMapNavUI(2);
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
            let circle50 = null;
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
                const container = L.DomUtil.create('div', 'flex flex-col items-end gap-2 mt-16 mr-2');
                container.id = 'map-overlay-topright';
                const btn = L.DomUtil.create('button', 'bg-slate-950/40 text-white hover:bg-slate-900/60 w-10 h-10 flex items-center justify-center rounded-lg shadow-xl cursor-pointer border border-white/5 backdrop-blur-sm transition-colors mb-2', container);
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
                    <div class="bg-blue-600/40 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 cursor-pointer" id="label-high">High Risk: -</div>
                    <div class="bg-red-600/40 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 cursor-pointer" id="label-elevated">Elevated Risk: -</div>
                    <div class="bg-orange-600/40 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 cursor-pointer" id="label-baseline">Baseline: -</div>
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
	                countyFips = normalizeCountyFips(countyFips);
	                if (!countyFips) return;
	
	                const textEl = document.getElementById('map-loading-text');
	                if (textEl) textEl.textContent = "Loading Lite Data...";
                try
                {
                    // 1. Load Calculation Context (buffered point data for zones)
                    const ok = await loadCountyContext(countyFips, true);
                    if (!ok) return;

                    // 2. Set Visuals
                    currentCountyFips = countyFips;
                    highlightCountyVisuals(countyFips, currentContextGeoJSON, skipMarkerMove);

                    calculateImpact();

                    const cInfo = getCountyReference().find(c => c.geoid === currentCountyFips);
                    if (cInfo)
                    {
                        window.dispatchEvent(new CustomEvent('county-selected-map', { detail: { name: cInfo.name, pop: cInfo.pop || 0, geoid: currentCountyFips } }));
                    }

                    if (layersVisible.blocks || layersVisible.heatmap || layersVisible.tracts)
                    {
                        await ensureContextLayers();
                    }
                    updateMapNavUI(3);
                }
                finally
                {
                    if (textEl) textEl.textContent = "Loading Regional Data...";
                }
            }

            // ... (keep surrounding code) ...

	            function highlightCountyVisuals(countyFips, contextData, skipMarkerMove = false)
	            {
	                if (!countyData) 
	                {
                    console.warn("highlightCountyVisuals: countyData is missing.");
                    return;
                }
                const countyFeature = countyData.features.find(f => f.properties.GEOID === countyFips);
                if (!countyFeature)
                {
                    console.warn(`highlightCountyVisuals: Feature not found for ${countyFips}`);
                }
	
	                if (highlightLayer) map.removeLayer(highlightLayer);
	                if (countyFeature)
	                {
	                    highlightLayer = L.geoJSON(countyFeature, {
	                        style: {
	                            color: '#ffffff',
	                            weight: 3,
	                            fillOpacity: 0,
	                            dashArray: '1, 7',
	                            lineCap: 'round',
	                            lineJoin: 'round'
	                        },
	                        interactive: false
	                    });
	                }
	                if (blockGroupLayer)
	                {
                    if (map.hasLayer(blockGroupLayer)) map.removeLayer(blockGroupLayer);
                    blockGroupLayer = null;
                }
                if (tractLayer)
                {
                    if (map.hasLayer(tractLayer)) map.removeLayer(tractLayer);
                    tractLayer = null;
                }

                if (countyFeature && !skipMarkerMove)
	                {
	                    const bounds = L.geoJSON(countyFeature).getBounds();
	                    const latLng = bounds.getCenter();

	                    if (!marker)
	                    {
	                        marker = L.marker(latLng, { draggable: true, autoPan: false, icon: casinoPin }).addTo(map);
	                        circle20 = L.circle(latLng, { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.35, weight: 2, dashArray: '5, 5', radius: 32186.9, interactive: false }).addTo(map);
	                        circle10 = L.circle(latLng, { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.25, weight: 2, radius: 16093.4, interactive: false }).addTo(map);
	                        circle50 = L.circle(latLng, { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.12, weight: 2, dashArray: '2, 6', radius: 80467.2, interactive: false }).addTo(map);
	
	                        marker.on('drag', () =>
	                        {
	                            const pos = marker.getLatLng();
	                            circle10.setLatLng(pos); circle20.setLatLng(pos); if (circle50) circle50.setLatLng(pos);
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
                                        if (cInfo) window.dispatchEvent(new CustomEvent('county-selected-map', { detail: { name: cInfo.name, pop: cInfo.pop, geoid: newCountyFips } }));
                                    }
                                }
                            }
                            calculateImpact();
                        });
                    } else
                    {
                        marker.setLatLng(latLng); circle10.setLatLng(latLng); circle20.setLatLng(latLng); if (circle50) circle50.setLatLng(latLng);
                    }

                    if (circle50)
                    {
                        map.fitBounds(circle50.getBounds(), { padding: [20, 20] });
                    } else
                    {
                        map.fitBounds(bounds, { padding: [50, 50] });
                    }
                }
                updateLayerVisibility();
                const cInfo = getCountyReference().find(c => c.geoid === countyFips);
                if (els.displayCounty && cInfo) els.displayCounty.textContent = cInfo.name;
            }

            let currentContextGeoJSON = null;
            let currentCalcFeatures = null;
            let currentCountyTotals = null;
            let contextIsLite = false;
            let contextCache = {};

            // Debug Logger
            function logToUI(msg)
            {
                try {
                    console.log(msg);
                } catch(e) {
                    console.error("Logging failed", e);
                }
            }

            function formatBytes(bytes)
            {
                if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
                const units = ["B", "KB", "MB", "GB"];
                const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
                const scaled = bytes / Math.pow(1024, idx);
                const digits = idx === 0 ? 0 : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
                return `${scaled.toFixed(digits)} ${units[idx]}`;
            }

            let activeContextLoad = null;
            let contextLoadSeq = 0;

	            async function loadCountyContext(fips, lite = false)
	            {
	                fips = normalizeCountyFips(fips);
	                if (!fips) return false;

	                if (contextCache[fips])
	                {
	                    const cached = contextCache[fips];
	                    if (!(!lite && cached.isLite))
                    {
                        currentContextGeoJSON = cached.geojson;
                        currentCalcFeatures = cached.calcFeatures;
                        currentCountyTotals = cached.totals;
                        contextIsLite = cached.isLite;
                        return true;
                    }
                }

                if (activeContextLoad)
                {
                    const sameFips = activeContextLoad.fips === fips;
                    const activeSatisfiesRequest = sameFips && (activeContextLoad.lite === false || activeContextLoad.lite === lite);
                    if (activeSatisfiesRequest) return activeContextLoad.promise;

                    try { activeContextLoad.controller.abort(); } catch { }
                }

                const loadId = ++contextLoadSeq;
                const controller = new AbortController();
                const timeoutMs = lite ? 45000 : 90000;
                const timeoutId = setTimeout(() =>
                {
                    try { controller.abort(); } catch { }
                }, timeoutMs);

                toggleLoading(true);
                logToUI(`Loading ${fips}...`);

                const promise = (async () =>
                {
                    try
                    {
                        logToUI(`Fetching... (${Math.round(timeoutMs / 1000)}s timeout)`);
                        const ts = new Date().getTime();
                        const res = await fetch(`/api/Impact/county-context/${fips}?lite=${lite}&_ts=${ts}`, {
                            signal: controller.signal,
                            cache: 'no-store'
                        });

                        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

                        const contentLength = Number(res.headers.get('content-length') || 0) || 0;
                        const contentEncoding = res.headers.get('content-encoding') || "";
                        logToUI(`Downloading... ${contentLength ? `(${formatBytes(contentLength)})` : ""}${contentEncoding ? ` [${contentEncoding}]` : ""}`.trim());

                        const textEl = document.getElementById('map-loading-text');
                        let lastUiUpdateMs = 0;
                        let lastProgressLogMs = 0;

                        async function readTextWithProgress()
                        {
                            if (!res.body || !res.body.getReader)
                            {
                                const tick = setInterval(() => logToUI("Downloading..."), 5000);
                                try { return await res.text(); }
                                finally { clearInterval(tick); }
                            }

                            const reader = res.body.getReader();
                            const decoder = new TextDecoder();
                            const parts = [];
                            let received = 0;

                            while (true)
                            {
                                const { done, value } = await reader.read();
                                if (done) break;
                                if (value)
                                {
                                    received += value.byteLength;
                                    parts.push(decoder.decode(value, { stream: true }));

                                    const nowMs = Date.now();
                                    if (nowMs - lastUiUpdateMs >= 500)
                                    {
                                        lastUiUpdateMs = nowMs;
                                        if (textEl && contentLength > 0)
                                        {
                                            textEl.textContent = `Downloading... ${formatBytes(received)} / ${formatBytes(contentLength)}`;
                                        }
                                        await new Promise(requestAnimationFrame);
                                    }

                                    if (nowMs - lastProgressLogMs >= 5000)
                                    {
                                        lastProgressLogMs = nowMs;
                                        if (contentLength > 0)
                                        {
                                            const pct = Math.min(100, Math.max(0, (received / contentLength) * 100));
                                            logToUI(`Downloading... ${formatBytes(received)} / ${formatBytes(contentLength)} (${pct.toFixed(1)}%)`);
                                        } else
                                        {
                                            logToUI(`Downloading... ${formatBytes(received)}`);
                                        }
                                    }
                                }
                            }

                            parts.push(decoder.decode());
                            if (textEl) textEl.textContent = "Downloading...";
                            return parts.join('');
                        }

                        const text = await readTextWithProgress();

                        logToUI(`Parsing JSON (${text.length} chars)...`);
                        await new Promise(requestAnimationFrame);

                        const data = JSON.parse(text);

                        // 4. Process Payload
                        logToUI("Processing...");

                        let geojson = null;
                        let calcFeatures = [];
                        let countyAdults = 0;
                        let countyTotal = 0;

                        const cachedExisting = contextCache[fips];
                        const preserveCalc = !lite &&
                            cachedExisting &&
                            Array.isArray(cachedExisting.calcFeatures) &&
                            cachedExisting.calcFeatures.length > 0 &&
                            cachedExisting.totals;

                        if (preserveCalc)
                        {
                            calcFeatures = cachedExisting.calcFeatures;
                            countyAdults = Number(cachedExisting.totals.adults || 0);
                            countyTotal = Number(cachedExisting.totals.total || 0);
                        }

                        // Lite payload can be a compact { points: [[lng,lat,popAdult], ...], county_total, county_adults }
                        if (data && Array.isArray(data.points))
                        {
                            const points = data.points;
                            logToUI(`Parsed ${points.length} points.`);

                            countyAdults = Number(data.county_adults || 0);
                            countyTotal = Number(data.county_total || 0);

                            calcFeatures = [];
                            for (let j = 0; j < points.length; j++)
                            {
                                if (j > 0 && (j % 5000) === 0) await new Promise(requestAnimationFrame);

                                const p = points[j];
                                if (!p || p.length < 3) continue;
                                const lng = Number(p[0]);
                                const lat = Number(p[1]);
                                const popAdult = Number(p[2] || 0);
                                const countyFips = (p.length >= 4 && p[3] != null) ? String(p[3]) : "";
                                if (!Number.isFinite(lng) || !Number.isFinite(lat) || popAdult <= 0) continue;
                                calcFeatures.push({ lng, lat, popAdult, countyFips });
                            }
                        } else
                        {
                            geojson = data;
                            const features = (data && Array.isArray(data.features)) ? data.features : [];
                            logToUI(`Parsed ${features.length} features.`);

                            for (let j = 0; !preserveCalc && j < features.length; j++)
                            {
                                if (j > 0 && (j % 2000) === 0) await new Promise(requestAnimationFrame);

                                const f = features[j];
                                if (!f) continue;

                                const props = f.properties || (f.properties = {});

                                const geoid = String(props.GEOID || props.geoid || "");
                                if (geoid) props.GEOID = geoid;

                                const popAdult = Number(props.POP_ADULT || 0);
                                const popTotal = Number(props.POPULATION || 0);
                                props.POP_ADULT = popAdult;
                                props.POPULATION = popTotal;

                                if (geoid.startsWith(fips))
                                {
                                    countyAdults += popAdult;
                                    countyTotal += popTotal;
                                }

                                const cx = Number(props.CX || 0);
                                const cy = Number(props.CY || 0);
                                props.CX = cx;
                                props.CY = cy;

                                // Prefer server-provided point-on-surface to avoid expensive turf.centroid calls.
                                if (Number.isFinite(cx) && Number.isFinite(cy) && (cx !== 0 || cy !== 0))
                                {
                                    calcFeatures.push({ lng: cx, lat: cy, popAdult, countyFips: fips });
                                } else if (f.geometry)
                                {
                                    try
                                    {
                                        const coords = turf.centroid(f).geometry.coordinates;
                                        if (coords && coords.length === 2) calcFeatures.push({ lng: coords[0], lat: coords[1], popAdult, countyFips: fips });
                                    } catch { }
                                }
                            }
                        }

                        contextCache[fips] = {
                            geojson: geojson,
                            calcFeatures: calcFeatures,
                            totals: { adults: countyAdults, total: countyTotal },
                            isLite: lite
                        };

                        const isStale = !activeContextLoad || activeContextLoad.id !== loadId;
                        if (!isStale)
                        {
                            contextIsLite = lite;
                            currentContextGeoJSON = geojson;
                            currentCalcFeatures = calcFeatures;
                            currentCountyTotals = { adults: countyAdults, total: countyTotal };
                        }

                        logToUI(`Success. (${calcFeatures.length} points)`);
                        return true;
                    } catch (e)
                    {
                        if (e && e.name === 'AbortError')
                        {
                            logToUI("Cancelled or timed out.");
                        } else
                        {
                            logToUI(`Error: ${e.message}`);
                            console.error("Context Load Error", e);
                        }
                        return false;
                    } finally
                    {
                        clearTimeout(timeoutId);
                        if (activeContextLoad && activeContextLoad.id === loadId)
                        {
                            activeContextLoad = null;
                            toggleLoading(false);
                        }
                    }
                })();

                activeContextLoad = { id: loadId, fips, lite, controller, promise };
                return promise;
            }

            async function ensureContextLayers()
            {
                if (!currentCountyFips) return;
                if (!currentContextGeoJSON || contextIsLite)
                {
                    toggleLoading(true);
                    const textEl = document.getElementById('map-loading-text');
                    if (textEl) textEl.textContent = "Loading Layer Data...";
                    try
                    {
                        const ok = await loadCountyContext(currentCountyFips, false);
                        if (!ok) return;
                    } finally
                    {
                        if (textEl) textEl.textContent = "Loading Regional Data...";
                        toggleLoading(false);
                    }
                }
                if (currentContextGeoJSON)
                {
                    buildContextLayers(currentCountyFips, currentContextGeoJSON);
                    updateLayerVisibility();
                }
            }

            function buildContextLayers(countyFips, contextData)
            {
                if (!layersVisible.blocks && !layersVisible.heatmap && !layersVisible.tracts) return;
                if (!contextData || !contextData.features) return;
                const countyFeatures = contextData.features.filter(f =>
                {
                    const geoid = f.properties.GEOID || "";
                    return geoid.startsWith(countyFips);
                });

                const countyGeoJSON = { type: "FeatureCollection", features: countyFeatures };

                if (layersVisible.blocks || layersVisible.heatmap)
                {
                    let maxPop = 0;

                    turf.featureEach(countyGeoJSON, (f) =>
                    {
                        const p = Number((f && f.properties && f.properties.POP_ADULT) || 0);
                        if (p > maxPop) maxPop = p;
                    });

                    if (maxPop === 0) maxPop = 1;

                    turf.featureEach(countyGeoJSON, (f) =>
                    {
                        if (!f.properties) f.properties = {};
                        const p = Number(f.properties.POP_ADULT || 0);
                        f.properties._density = p;
                        f.properties._maxDensity = maxPop;
                    });

                    if (blockGroupLayer)
                    {
                        map.removeLayer(blockGroupLayer);
                        blockGroupLayer = null;
                    }

                    blockGroupLayer = L.geoJSON(countyGeoJSON, { style: getHeatMapStyle, interactive: false });
                }

                if (layersVisible.tracts)
                {
                    if (tractLayer)
                    {
                        map.removeLayer(tractLayer);
                        tractLayer = null;
                    }
                    tractLayer = generateTractLayer(countyGeoJSON);
                }
            }

            function generateTractLayer(geoJSON)
            {
                if (!geoJSON) return null;
                try
                {
                    const clone = JSON.parse(JSON.stringify(geoJSON));
                    for (let i = 0; i < clone.features.length; i++)
                    {
                        const f = clone.features[i];
                        if (!f || !f.properties) continue;
                        const geoid = String(f.properties.GEOID || "");
                        if (geoid.length >= 11) f.properties.TRACTCE = geoid.substring(5, 11);
                    }
                    const dissolved = turf.dissolve(clone, { propertyName: 'TRACTCE' });
                    return L.geoJSON(dissolved, { style: { color: '#1e293b', weight: 2, fillOpacity: 0, dashArray: '2, 4' }, interactive: false });
                } catch (e) { console.error("Tract gen failed", e); return null; }
            }

            /* Commented out geocoder as requested
            const geocoder = L.Control.geocoder({
                defaultMarkGeocode: false, collapsed: false, placeholder: "Search for an address...", suggestMinLength: 3, suggestTimeout: 300,
                geocoder: L.Control.Geocoder.nominatim({ geocodingQueryParams: { countrycodes: 'us', viewbox: '-88.2,42.0,-84.6,37.5', bounded: 1, limit: 5 } })
            }).on('markgeocode', function (e)
            {
                const center = e.geocode.center;
                if (!marker)
                {
                    marker = L.marker(center, { draggable: true, autoPan: false, icon: casinoPin }).addTo(map);
                    circle20 = L.circle(center, { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.35, weight: 2, dashArray: '5, 5', radius: 32186.9, interactive: false }).addTo(map);
                    circle10 = L.circle(center, { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.25, weight: 2, radius: 16093.4, interactive: false }).addTo(map);
                    circle50 = L.circle(center, { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.12, weight: 2, dashArray: '2, 6', radius: 80467.2, interactive: false }).addTo(map);
                } else
                {
                    marker.setLatLng(center); circle10.setLatLng(center); circle20.setLatLng(center); if (circle50) circle50.setLatLng(center);
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
            */

            function calculateImpact()
            {
                // CLIENT SIDE ONLY - No Fetch
                if (!currentCalcFeatures || !currentCountyTotals || !marker || !currentCountyFips) return;

                const baselineRate = parseFloat(els.inputRate ? els.inputRate.value : 2.3);
                const markerLatLng = marker.getLatLng();

                const toRad = Math.PI / 180;
                const earthRadiusMiles = 3958.7613;
                const centerLat = markerLatLng.lat;
                const centerLng = markerLatLng.lng;

                function distanceMiles(lng1, lat1, lng2, lat2)
                {
                    const dLat = (lat2 - lat1) * toRad;
                    const dLng = (lng2 - lng1) * toRad;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    return earthRadiusMiles * c;
                }

                let t1PopCounty = 0;
                let t2PopCounty = 0;
                let t3PopCounty = 0; // 20-50 miles (baseline)

                let t1PopRegional = 0;
                let t2PopRegional = 0;
                let t3PopRegional = 0; // 20-50 miles (baseline)
                const byCounty = {};
                const countyAdults = currentCountyTotals.adults || 0;
                const countyTotal = currentCountyTotals.total || 0;
                const stateFips = String(currentCountyFips || "").substring(0, 2);

                for (let i = 0; i < currentCalcFeatures.length; i++)
                {
                    const entry = currentCalcFeatures[i];
                    if (!entry) continue;
                    const popAdult = Number(entry.popAdult || 0);
                    if (!Number.isFinite(popAdult) || popAdult <= 0) continue;

                    const entryCountyFips = String(entry.countyFips || "");
                    const effectiveCountyFips = entryCountyFips || currentCountyFips;
                    const isSameCounty = effectiveCountyFips === currentCountyFips;
                    const isSameState = !stateFips || effectiveCountyFips.substring(0, 2) === stateFips;
                    if (!isSameState) continue;

                    const dist = distanceMiles(centerLng, centerLat, entry.lng, entry.lat);
                    const bucket = byCounty[effectiveCountyFips] || (byCounty[effectiveCountyFips] = { fips: effectiveCountyFips, t1Pop: 0, t2Pop: 0, t3Pop: 0 });
                    if (dist <= 10)
                    {
                        t1PopRegional += popAdult;
                        if (isSameCounty) t1PopCounty += popAdult;

                        bucket.t1Pop += popAdult;
                    } else if (dist <= 20)
                    {
                        t2PopRegional += popAdult;
                        if (isSameCounty) t2PopCounty += popAdult;

                        bucket.t2Pop += popAdult;
                    } else if (dist <= 50)
                    {
                        t3PopRegional += popAdult;
                        if (isSameCounty) t3PopCounty += popAdult;

                        bucket.t3Pop += popAdult;
                    }
                }

                const regionalAdultsWithin50 = t1PopRegional + t2PopRegional + t3PopRegional;
                const countyAdultsWithin50 = t1PopCounty + t2PopCounty + t3PopCounty;

                // --- NEW CALCULATION LOGIC ---
                // PreRate (Baseline)
                const preRate = baselineRate;

                // PostRates
                const r1 = preRate * 2.0; 
                const r2 = preRate * 1.5; 
                const r3 = preRate * 1.0;

                // DeltaRates (Net New)
                const d1 = Math.max(0, r1 - preRate);
                const d2 = Math.max(0, r2 - preRate);
                const d3 = Math.max(0, r3 - preRate);

                const t1PopOther = Math.max(0, t1PopRegional - t1PopCounty);
                const t2PopOther = Math.max(0, t2PopRegional - t2PopCounty);
                const t3PopOther = Math.max(0, t3PopRegional - t3PopCounty);

                // Total Estimated (PostRate * Pop)
                const v1Total = t1PopRegional * (r1 / 100);
                const v2Total = t2PopRegional * (r2 / 100);
                const v3Total = t3PopRegional * (r3 / 100);

                const v1County = t1PopCounty * (r1 / 100);
                const v2County = t2PopCounty * (r2 / 100);
                const v3County = t3PopCounty * (r3 / 100);

                const v1Other = t1PopOther * (r1 / 100);
                const v2Other = t2PopOther * (r2 / 100);
                const v3Other = t3PopOther * (r3 / 100);
                
                const totalEstimatedCounty = v1County + v2County + v3County;
                const totalEstimatedRegional = v1Total + v2Total + v3Total;

                // Net New (DeltaRate * Pop)
                const n1Total = t1PopRegional * (d1 / 100);
                const n2Total = t2PopRegional * (d2 / 100);
                const n3Total = t3PopRegional * (d3 / 100);

                const n1County = t1PopCounty * (d1 / 100);
                const n2County = t2PopCounty * (d2 / 100);
                const n3County = t3PopCounty * (d3 / 100);

                const n1Other = t1PopOther * (d1 / 100);
                const n2Other = t2PopOther * (d2 / 100);
                const n3Other = t3PopOther * (d3 / 100);

                const totalNetNewCounty = n1County + n2County + n3County;
                const totalNetNewRegional = n1Total + n2Total + n3Total;

                animateValue(els.t1, t1PopRegional);
                animateValue(els.t2, t2PopRegional);
                const labelT3 = document.getElementById('label-t3');
                animateValue(els.t3, t3PopRegional);
                els.t3.classList.add('text-xl', 'font-black', 'text-white', 'mb-1'); els.t3.classList.remove('text-xs', 'font-bold', 'uppercase');
                if (labelT3) labelT3.textContent = "Adult Population (18+) — State Total";

                function setNum(id, val)
                {
                    const el = document.getElementById(id);
                    if (el) el.textContent = Math.round(val).toLocaleString();
                }

                setNum('val-t1-county', t1PopCounty);
                setNum('val-t1-other', t1PopOther);
                setNum('val-t2-county', t2PopCounty);
                setNum('val-t2-other', t2PopOther);
                setNum('val-t3-county', t3PopCounty);
                setNum('val-t3-other', t3PopOther);

                if (els.rateT1) els.rateT1.textContent = r1.toFixed(1) + '%';
                if (els.rateT2) els.rateT2.textContent = r2.toFixed(1) + '%';
                if (els.rateT3) els.rateT3.textContent = r3.toFixed(1) + '%';
                
                // Update Total Estimated
                if (els.vicT1) els.vicT1.textContent = Math.round(v1Total).toLocaleString();
                if (els.vicT2) els.vicT2.textContent = Math.round(v2Total).toLocaleString();
                if (els.vicT3) els.vicT3.textContent = Math.round(v3Total).toLocaleString();

                setNum('victims-t1-county', v1County);
                setNum('victims-t1-other', v1Other);
                setNum('victims-t2-county', v2County);
                setNum('victims-t2-other', v2Other);
                setNum('victims-t3-county', v3County);
                setNum('victims-t3-other', v3Other);

                // Update Net New
                setNum('net-new-t1', n1Total);
                setNum('net-new-t2', n2Total);
                setNum('net-new-t3', n3Total);

                setNum('net-new-t1-county', n1County);
                setNum('net-new-t1-other', n1Other);
                setNum('net-new-t2-county', n2County);
                setNum('net-new-t2-other', n2Other);
                setNum('net-new-t3-county', n3County);
                setNum('net-new-t3-other', n3Other);

                // Summary: Net New (Attributable)
                if (els.totalVictims) els.totalVictims.textContent = Math.round(totalNetNewCounty).toLocaleString();

                const lblHigh = document.getElementById('label-high');
                const lblElevated = document.getElementById('label-elevated');
                const lblBaseline = document.getElementById('label-baseline');
                if (lblHigh) lblHigh.textContent = `High Risk: ${Math.round(t1PopRegional).toLocaleString()}`;
                if (lblElevated) lblElevated.textContent = `Elevated Risk: ${Math.round(t2PopRegional).toLocaleString()}`;
                if (lblBaseline) lblBaseline.textContent = `Baseline: ${Math.round(t3PopRegional).toLocaleString()}`;

                const calcRes = document.getElementById('calc-result');
                const calcGamblers = document.getElementById('calc-gamblers');
                if (calcRes) calcRes.textContent = Math.round(totalNetNewCounty).toLocaleString();
                if (calcGamblers) calcGamblers.textContent = Math.round(totalNetNewCounty).toLocaleString();

                const dispPop = document.getElementById('disp-pop-impact-zones');
                const dispPopAdults = document.getElementById('disp-pop-adults');
                const dispRateAdult = document.getElementById('disp-rate-adult');
                const dispRateTotal = document.getElementById('disp-rate-total');

                // DISPLAY TOTAL POPULATION (ALL AGES)
                if (dispPop) dispPop.textContent = countyTotal.toLocaleString();
                // DISPLAY ADULT POPULATION (18+)
                if (dispPopAdults) dispPopAdults.textContent = countyAdults.toLocaleString();

                const countyInfo = getCountyReference().find(c => c.geoid === currentCountyFips);
                if (countyInfo)
                {
                    countyInfo.pop = countyTotal;
                    const displayEl = document.getElementById('county-display');
                    if (displayEl) displayEl.textContent = countyInfo.name ? `${countyInfo.name} (${countyTotal.toLocaleString()})` : countyTotal.toLocaleString();
                }

                if (dispRateAdult)
                {
                    // UPDATED: Calculate effective rate based on Adult Population (18+)
                    // Uses Total Estimated for prevalence rate
                    const effectiveRate = countyAdults > 0 ? (totalEstimatedCounty / countyAdults) * 100 : 0;
                    dispRateAdult.textContent = effectiveRate.toFixed(2) + '%';
                }

                if (dispRateTotal)
                {
                    // UPDATED: Calculate effective rate based on Total Population (All Ages) as secondary metric
                    const effectiveRate = countyTotal > 0 ? (totalEstimatedCounty / countyTotal) * 100 : 0;
                    dispRateTotal.textContent = effectiveRate.toFixed(2) + '%';
                }

                const dispRegionalAdults50 = document.getElementById('disp-pop-regional-50');
                if (dispRegionalAdults50) dispRegionalAdults50.textContent = Math.round(regionalAdultsWithin50).toLocaleString();
                const dispRegionalVictims50 = document.getElementById('disp-victims-regional-50');
                if (dispRegionalVictims50) dispRegionalVictims50.textContent = Math.round(totalNetNewRegional).toLocaleString();

                const dispRegionalVictimsOther = document.getElementById('disp-victims-regional-other');
                if (dispRegionalVictimsOther)
                {
                    const victimsOther = Math.max(0, totalNetNewRegional - totalNetNewCounty);
                    dispRegionalVictimsOther.textContent = Math.round(victimsOther).toLocaleString();
                }

	                const impactedCounties = Object.values(byCounty)
	                    .filter(c => c && (c.t1Pop + c.t2Pop + c.t3Pop) > 0)
	                    .sort((a, b) => (b.t1Pop + b.t2Pop + b.t3Pop) - (a.t1Pop + a.t2Pop + a.t3Pop));
	                const dispRegionalCounties = document.getElementById('disp-regional-counties');
		                if (dispRegionalCounties) dispRegionalCounties.textContent = impactedCounties.length.toLocaleString();
	
		                const impactedCounties20 = impactedCounties.filter(c => c && (c.t1Pop + c.t2Pop) > 0);
		                const dispRegionalCounties20 = document.getElementById('disp-regional-counties-20');
		                if (dispRegionalCounties20) dispRegionalCounties20.textContent = `≤20 mi: ${impactedCounties20.length.toLocaleString()}`;

                try
                {
                    const stateName = (() =>
                    {
                        try
                        {
                            const normalized = String(stateFips || "").padStart(2, '0');
                            if (stateData && Array.isArray(stateData.features))
                            {
                                const stateFeature = stateData.features.find(f =>
                                {
                                    const geoid = f && f.properties ? (f.properties.GEOID || f.properties.geoid || "") : "";
                                    return String(geoid).padStart(2, '0') === normalized;
                                });
                                const name = stateFeature && stateFeature.properties ? (stateFeature.properties.NAME || stateFeature.properties.name || "") : "";
                                if (name) return String(name).trim();
                            }

                            const fromDisplay = els && els.stateDisplay ? String(els.stateDisplay.textContent || "").trim() : "";
                            if (fromDisplay) return fromDisplay;

                            return normalized;
                        } catch
                        {
                            return String(stateFips || "").trim();
                        }
                    })();

                    window.dispatchEvent(new CustomEvent('impact-breakdown-updated', {
                        detail: {
                            countyFips: currentCountyFips,
                            stateFips,
                            stateName,
                            baselineRate,
                            county: {
                                adults: countyAdults,
                                total: countyTotal,
                                t1Adults: t1PopCounty,
                                t2Adults: t2PopCounty,
                                t3Adults: t3PopCounty,
                                adultsWithin50: countyAdultsWithin50,
                                victims: { t1: n1County, t2: n2County, t3: n3County, total: totalNetNewCounty },
                                totalEstimated: { t1: v1County, t2: v2County, t3: v3County, total: totalEstimatedCounty }
                            },
                            regional: {
                                adultsWithin50: regionalAdultsWithin50,
                                t1Adults: t1PopRegional,
                                t2Adults: t2PopRegional,
                                t3Adults: t3PopRegional,
                                victimsWithin50: totalNetNewRegional
                            },
                            byCounty: impactedCounties
                        }
                    }));
                } catch { }

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
                    if (!val || val === currentCountyFips) return;
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

            window._ImpactMapInstance = {
                navigateToStep: navigateToStep,
                updateMapNavUI: updateMapNavUI,
                loadState: loadStateCounties,
                loadCounty: loadCounty
            };
        },
        navigateToStep: (step) => {
            if (window._ImpactMapInstance) window._ImpactMapInstance.navigateToStep(step);
        },
        loadState: (fips) => {
            if (window._ImpactMapInstance) window._ImpactMapInstance.loadState(fips);
        },
        loadCounty: (fips) => {
            if (window._ImpactMapInstance) window._ImpactMapInstance.loadCounty(fips);
        }
    };
})();

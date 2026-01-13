/**
 * MapLibre GL JS Impact Map - Complete Implementation
 * 
 * Full replacement for Leaflet-based map.js, providing GPU-accelerated rendering,
 * native vector tile support, Valhalla isochrone visualization, and complete
 * impact calculation engine.
 *
 * @module MapLibreImpactMap
 * @version 2.0.0 - Full Migration
 */

window.MapLibreImpactMap = (function ()
{
    'use strict';

    // === CONSTANTS ===
    const MILE_TO_METERS = 1609.34;
    const EARTH_RADIUS_MILES = 3958.7613;
    const TO_RAD = Math.PI / 180;

    const CIRCLE_RADII = {
        tier1: 10 * MILE_TO_METERS,
        tier2: 20 * MILE_TO_METERS,
        tier3: 50 * MILE_TO_METERS
    };

    const TIER_COLORS = {
        tier1: '#3b82f6',
        tier2: '#ef4444',
        tier3: '#f59e0b'
    };

    const ISOCHRONE_COLORS = {
        5: '#22c55e',
        10: '#84cc16',
        15: '#eab308',
        30: '#ef4444'
    };

    const DEFAULT_CENTER = [-98.35, 39.5];
    const DEFAULT_ZOOM = 4;

    // === STATE ===
    let map = null;
    let marker = null;
    let currentStateFips = null;
    let currentCountyFips = null;
    let markerPosition = null;
    let stateData = null;
    let countyData = null;

    // Context data for calculations
    let currentContextGeoJSON = null;
    let currentCalcFeatures = null;
    let currentCountyTotals = null;
    let contextIsLite = false;
    let contextCache = {};

    // Cache references
    const cache = {
        states: null,
        counties: {},
        context: {}
    };

    // Layer visibility state
    const layersVisible = {
        zones: true,
        boundary: true,
        overlay: true,
        blocks: false,
        tracts: false,
        heatmap: false,
        streets: false,
        isochrones: false,
        terrain3d: false,
        buildings3d: false
    };

    // Current basemap
    let currentBasemap = 'satellite';

    // Basemap configurations
    const BASEMAPS = {
        satellite: {
            name: 'Satellite',
            icon: 'satellite_alt',
            style: {
                version: 8,
                sources: {
                    'satellite-tiles': {
                        type: 'raster',
                        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                        tileSize: 256
                    }
                },
                layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles' }]
            }
        },
        streets: {
            name: 'Streets',
            icon: 'map',
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        },
        terrain: {
            name: 'Terrain',
            icon: 'terrain',
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
        },
        hybrid: {
            name: 'Hybrid',
            icon: 'layers',
            style: {
                version: 8,
                sources: {
                    'satellite-tiles': {
                        type: 'raster',
                        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                        tileSize: 256
                    },
                    'labels': {
                        type: 'vector',
                        url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                    }
                },
                layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles' }]
            }
        }
    };

    // DOM Elements cache
    let els = {};

    // === UTILITY FUNCTIONS ===

    function normalizeCountyFips(value)
    {
        const s = String(value == null ? "" : value).trim();
        if (!s) return "";
        return /^\d+$/.test(s) ? s.padStart(5, '0') : s;
    }

    function distanceMiles(lng1, lat1, lng2, lat2)
    {
        const dLat = (lat2 - lat1) * TO_RAD;
        const dLng = (lng2 - lng1) * TO_RAD;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * TO_RAD) * Math.cos(lat2 * TO_RAD) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_MILES * c;
    }

    function formatBytes(bytes)
    {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
        const scaled = bytes / Math.pow(1024, idx);
        return `${scaled.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
    }

    function setNum(id, val)
    {
        const el = document.getElementById(id);
        if (el) el.textContent = Math.round(val).toLocaleString();
    }

    function animateValue(el, val)
    {
        if (!el) return;
        el.textContent = Math.round(val).toLocaleString();
    }

    // === CIRCLE GENERATION ===

    function createCircleGeoJSON(center, radiusMeters, steps = 64)
    {
        if (typeof turf !== 'undefined' && turf.circle)
        {
            return turf.circle(center, radiusMeters / 1000, { steps, units: 'kilometers' });
        }
        const coords = [];
        for (let i = 0; i <= steps; i++)
        {
            const angle = (i / steps) * 2 * Math.PI;
            const dx = radiusMeters * Math.cos(angle);
            const dy = radiusMeters * Math.sin(angle);
            const lat = center[1] + (dy / 111320);
            const lng = center[0] + (dx / (111320 * Math.cos(center[1] * Math.PI / 180)));
            coords.push([lng, lat]);
        }
        return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
    }

    function updateCircles(lngLat)
    {
        if (!map) return;
        const circles = {
            type: 'FeatureCollection',
            features: [
                { ...createCircleGeoJSON([lngLat.lng, lngLat.lat], CIRCLE_RADII.tier3), properties: { tier: 3 } },
                { ...createCircleGeoJSON([lngLat.lng, lngLat.lat], CIRCLE_RADII.tier2), properties: { tier: 2 } },
                { ...createCircleGeoJSON([lngLat.lng, lngLat.lat], CIRCLE_RADII.tier1), properties: { tier: 1 } }
            ]
        };
        const source = map.getSource('impact-circles');
        if (source) source.setData(circles);
    }

    // === DATA LOADING ===

    async function loadStates()
    {
        if (cache.states) return cache.states;
        const res = await fetch('/api/census/states');
        const data = await res.json();
        if (data && Array.isArray(data.features))
        {
            data.features.forEach((f, i) =>
            {
                if (!f.properties) f.properties = {};
                f.properties.GEOID = String(f.properties.geoid || f.properties.GEOID || '').padStart(2, '0');
                f.properties.NAME = f.properties.NAME || f.properties.name || '';
                f.properties.POP_TOTAL = f.properties.POP_TOTAL || f.properties.pop_total || 0;
                f.id = i;
            });
        }
        cache.states = data;
        stateData = data;
        return data;
    }

    async function loadCounties(stateFips)
    {
        if (cache.counties[stateFips]) return cache.counties[stateFips];
        const res = await fetch(`/api/census/counties/${stateFips}`);
        const data = await res.json();
        if (data && Array.isArray(data.features))
        {
            data.features.forEach((f, i) =>
            {
                if (!f.properties) f.properties = {};
                f.properties.GEOID = normalizeCountyFips(f.properties.geoid || f.properties.GEOID);
                f.properties.NAME = f.properties.NAME || f.properties.name || '';
                f.properties.POP_TOTAL = f.properties.POP_TOTAL || f.properties.pop_total || 0;
                f.id = i;
            });
        }
        cache.counties[stateFips] = data;
        return data;
    }

    // === CONTEXT LOADING (Block Group Data) ===

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
            if (activeContextLoad.fips === fips && (activeContextLoad.lite === false || activeContextLoad.lite === lite))
            {
                return activeContextLoad.promise;
            }
            try { activeContextLoad.controller.abort(); } catch { }
        }

        const loadId = ++contextLoadSeq;
        const controller = new AbortController();
        const timeoutMs = lite ? 45000 : 90000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        toggleLoading(true);

        const promise = (async () =>
        {
            try
            {
                const ts = Date.now();
                const res = await fetch(`/api/Impact/county-context/${fips}?lite=${lite}&_ts=${ts}`, {
                    signal: controller.signal,
                    cache: 'no-store'
                });
                if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

                const text = await res.text();
                const data = JSON.parse(text);

                let geojson = null;
                let calcFeatures = [];
                let countyAdults = 0;
                let countyTotal = 0;

                if (data && Array.isArray(data.points))
                {
                    countyAdults = Number(data.county_adults || 0);
                    countyTotal = Number(data.county_total || 0);
                    for (const p of data.points)
                    {
                        if (!p || p.length < 3) continue;
                        const lng = Number(p[0]);
                        const lat = Number(p[1]);
                        const popAdult = Number(p[2] || 0);
                        const pCountyFips = (p.length >= 4 && p[3] != null) ? String(p[3]) : "";
                        if (!Number.isFinite(lng) || !Number.isFinite(lat) || popAdult <= 0) continue;
                        calcFeatures.push({ lng, lat, popAdult, countyFips: pCountyFips || fips });
                    }
                } else
                {
                    geojson = data;
                    const features = (data && Array.isArray(data.features)) ? data.features : [];
                    for (const f of features)
                    {
                        if (!f) continue;
                        const props = f.properties || (f.properties = {});
                        const geoid = String(props.GEOID || props.geoid || "");
                        const popAdult = Number(props.POP_ADULT || 0);
                        const popTotal = Number(props.POPULATION || 0);
                        if (geoid.startsWith(fips))
                        {
                            countyAdults += popAdult;
                            countyTotal += popTotal;
                        }
                        const cx = Number(props.CX || 0);
                        const cy = Number(props.CY || 0);
                        if (Number.isFinite(cx) && Number.isFinite(cy) && (cx !== 0 || cy !== 0))
                        {
                            calcFeatures.push({ lng: cx, lat: cy, popAdult, countyFips: fips });
                        } else if (f.geometry && typeof turf !== 'undefined')
                        {
                            try
                            {
                                const coords = turf.centroid(f).geometry.coordinates;
                                if (coords && coords.length === 2)
                                {
                                    calcFeatures.push({ lng: coords[0], lat: coords[1], popAdult, countyFips: fips });
                                }
                            } catch { }
                        }
                    }
                }

                contextCache[fips] = { geojson, calcFeatures, totals: { adults: countyAdults, total: countyTotal }, isLite: lite };

                if (!activeContextLoad || activeContextLoad.id === loadId)
                {
                    contextIsLite = lite;
                    currentContextGeoJSON = geojson;
                    currentCalcFeatures = calcFeatures;
                    currentCountyTotals = { adults: countyAdults, total: countyTotal };
                }
                return true;
            } catch (e)
            {
                console.error("Context Load Error", e);
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

    // === IMPACT CALCULATION ENGINE ===

    function calculateImpact()
    {
        if (!currentCalcFeatures || !currentCountyTotals || !markerPosition || !currentCountyFips) return;

        const baselineRate = parseFloat(els.inputRate ? els.inputRate.value : 2.3);
        const centerLat = markerPosition.lat;
        const centerLng = markerPosition.lng;

        let t1PopCounty = 0, t2PopCounty = 0, t3PopCounty = 0;
        let t1PopRegional = 0, t2PopRegional = 0, t3PopRegional = 0;
        const byCounty = {};
        const countyAdults = currentCountyTotals.adults || 0;
        const countyTotal = currentCountyTotals.total || 0;
        const stateFips = String(currentCountyFips || "").substring(0, 2);

        for (const entry of currentCalcFeatures)
        {
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

        const preRate = baselineRate;
        const r1 = preRate * 2.0, r2 = preRate * 1.5, r3 = preRate * 1.0;
        const d1 = Math.max(0, r1 - preRate), d2 = Math.max(0, r2 - preRate), d3 = 0;

        const t1PopOther = Math.max(0, t1PopRegional - t1PopCounty);
        const t2PopOther = Math.max(0, t2PopRegional - t2PopCounty);
        const t3PopOther = Math.max(0, t3PopRegional - t3PopCounty);

        const v1Total = t1PopRegional * (r1 / 100);
        const v2Total = t2PopRegional * (r2 / 100);
        const v3Total = t3PopRegional * (r3 / 100);
        const v1County = t1PopCounty * (r1 / 100);
        const v2County = t2PopCounty * (r2 / 100);
        const v3County = t3PopCounty * (r3 / 100);
        const totalEstimatedCounty = v1County + v2County + v3County;
        const totalEstimatedRegional = v1Total + v2Total + v3Total;

        const n1Total = t1PopRegional * (d1 / 100);
        const n2Total = t2PopRegional * (d2 / 100);
        const n3Total = t3PopRegional * (d3 / 100);
        const n1County = t1PopCounty * (d1 / 100);
        const n2County = t2PopCounty * (d2 / 100);
        const n3County = t3PopCounty * (d3 / 100);
        const totalNetNewCounty = n1County + n2County + n3County;
        const totalNetNewRegional = n1Total + n2Total + n3Total;

        // Update UI
        animateValue(els.t1, t1PopRegional);
        animateValue(els.t2, t2PopRegional);
        animateValue(els.t3, t3PopRegional);

        setNum('val-t1-county', t1PopCounty);
        setNum('val-t1-other', t1PopOther);
        setNum('val-t2-county', t2PopCounty);
        setNum('val-t2-other', t2PopOther);
        setNum('val-t3-county', t3PopCounty);
        setNum('val-t3-other', t3PopOther);

        if (els.rateT1) els.rateT1.textContent = r1.toFixed(1) + '%';
        if (els.rateT2) els.rateT2.textContent = r2.toFixed(1) + '%';
        if (els.rateT3) els.rateT3.textContent = r3.toFixed(1) + '%';

        if (els.vicT1) els.vicT1.textContent = Math.round(v1Total).toLocaleString();
        if (els.vicT2) els.vicT2.textContent = Math.round(v2Total).toLocaleString();
        if (els.vicT3) els.vicT3.textContent = Math.round(v3Total).toLocaleString();

        setNum('victims-t1-county', v1County);
        setNum('victims-t1-other', t1PopOther * (r1 / 100));
        setNum('victims-t2-county', v2County);
        setNum('victims-t2-other', t2PopOther * (r2 / 100));
        setNum('victims-t3-county', v3County);
        setNum('victims-t3-other', t3PopOther * (r3 / 100));

        setNum('net-new-t1', n1Total);
        setNum('net-new-t2', n2Total);
        setNum('net-new-t3', n3Total);
        setNum('net-new-t1-county', n1County);
        setNum('net-new-t1-other', t1PopOther * (d1 / 100));
        setNum('net-new-t2-county', n2County);
        setNum('net-new-t2-other', t2PopOther * (d2 / 100));

        if (els.totalVictims) els.totalVictims.textContent = Math.round(totalNetNewCounty).toLocaleString();

        const lblHighVal = document.getElementById('label-high-val');
        const lblElevatedVal = document.getElementById('label-elevated-val');
        const lblBaselineVal = document.getElementById('label-baseline-val');
        if (lblHighVal) lblHighVal.textContent = Math.round(t1PopRegional).toLocaleString();
        if (lblElevatedVal) lblElevatedVal.textContent = Math.round(t2PopRegional).toLocaleString();
        if (lblBaselineVal) lblBaselineVal.textContent = Math.round(t3PopRegional).toLocaleString();

        setNum('calc-result', totalNetNewCounty);
        setNum('calc-gamblers', totalNetNewCounty);
        setNum('disp-pop-impact-zones', countyTotal);
        setNum('disp-pop-adults', countyAdults);
        setNum('disp-pop-regional-50', regionalAdultsWithin50);
        setNum('disp-victims-regional-50', totalNetNewRegional);
        setNum('disp-victims-regional-other', Math.max(0, totalNetNewRegional - totalNetNewCounty));

        // Effective Rates
        const dispRateAdult = document.getElementById('disp-rate-adult');
        const dispRateTotal = document.getElementById('disp-rate-total');
        if (dispRateAdult)
        {
            const effectiveRate = countyAdults > 0 ? (totalEstimatedCounty / countyAdults) * 100 : 0;
            dispRateAdult.textContent = effectiveRate.toFixed(2) + '%';
        }
        if (dispRateTotal)
        {
            const effectiveRate = countyTotal > 0 ? (totalEstimatedCounty / countyTotal) * 100 : 0;
            dispRateTotal.textContent = effectiveRate.toFixed(2) + '%';
        }

        // Impacted Counties
        const impactedCounties = Object.values(byCounty).filter(c => c && (c.t1Pop + c.t2Pop + c.t3Pop) > 0);
        setNum('disp-regional-counties', impactedCounties.length);
        const impactedCounties20 = impactedCounties.filter(c => c && (c.t1Pop + c.t2Pop) > 0);
        const dispRegionalCounties20 = document.getElementById('disp-regional-counties-20');
        if (dispRegionalCounties20) dispRegionalCounties20.textContent = `≤20 mi: ${impactedCounties20.length.toLocaleString()}`;

        // Get state name for event
        let stateName = '';
        if (stateData && stateData.features)
        {
            const stateFeature = stateData.features.find(f =>
            {
                const geoid = f?.properties?.GEOID || f?.properties?.geoid || '';
                return String(geoid).padStart(2, '0') === stateFips;
            });
            if (stateFeature) stateName = stateFeature.properties?.NAME || stateFeature.properties?.name || '';
        }

        // Build byCounty array for calculator
        const byCountyArray = Object.entries(byCounty).map(([fips, data]) => ({
            fips,
            geoid: fips,
            t1Pop: data.t1Pop,
            t2Pop: data.t2Pop,
            t3Pop: data.t3Pop
        })).filter(c => c.t1Pop + c.t2Pop + c.t3Pop > 0);

        // Dispatch events
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
                    adultsWithin50: t1PopCounty + t2PopCounty + t3PopCounty,
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
                byCounty: byCountyArray
            }
        }));

        const triggerInput = document.getElementById('input-revenue');
        if (triggerInput) triggerInput.dispatchEvent(new Event('input'));
    }

    // === ISOCHRONE INTEGRATION ===

    async function fetchIsochrones(lat, lon, minutes = [5, 15, 30])
    {
        try
        {
            const results = await Promise.all(
                minutes.map(m => fetch(`/api/valhalla/isochrone?lat=${lat}&lon=${lon}&minutes=${m}`).then(r => r.json()))
            );
            return {
                type: 'FeatureCollection',
                features: results.map((r, i) => ({
                    type: 'Feature',
                    properties: { contour: minutes[i] },
                    geometry: r.features?.[0]?.geometry || r.geometry
                })).filter(f => f.geometry)
            };
        } catch (e)
        {
            console.error('Isochrone fetch failed:', e);
            return null;
        }
    }

    let isochroneTimeout = null;
    async function updateIsochrones(lngLat)
    {
        if (!layersVisible.isochrones) return;
        clearTimeout(isochroneTimeout);
        isochroneTimeout = setTimeout(async () =>
        {
            const data = await fetchIsochrones(lngLat.lat, lngLat.lng);
            if (data && map.getSource('isochrones'))
            {
                map.getSource('isochrones').setData(data);
            }
        }, 300);
    }

    // === UI FUNCTIONS ===

    function toggleLoading(show)
    {
        const mapEl = document.getElementById('impact-map');
        if (!mapEl) return;
        let overlay = document.getElementById('map-loading-overlay');
        if (!overlay && show)
        {
            overlay = document.createElement('div');
            overlay.id = 'map-loading-overlay';
            overlay.className = 'absolute inset-0 z-[500] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300';
            overlay.innerHTML = `<div class="flex flex-col items-center gap-4"><div class="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div><div class="text-white font-bold" id="map-loading-text">Loading...</div></div>`;
            mapEl.parentElement.appendChild(overlay);
        }
        if (overlay)
        {
            overlay.style.opacity = show ? '1' : '0';
            overlay.style.pointerEvents = show ? 'auto' : 'none';
        }
    }

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
            bar.className = bar.className.replace(/bg-\w+-\d+|shadow-\[.*?\]/g, '').trim();
            label.className = label.className.replace(/text-\w+-\d+/g, '').trim();
            if (i <= step)
            {
                bar.classList.add(colors[i].bar, colors[i].shadow);
                label.classList.add(colors[i].text);
            } else
            {
                bar.classList.add('bg-slate-700');
                label.classList.add('text-slate-600');
            }
        }
    }

    function resetImpactStats()
    {
        currentContextGeoJSON = null;
        currentCalcFeatures = null;
        currentCountyTotals = null;
        const idsToZero = ['val-t1', 'val-t2', 'val-t3', 'total-gamblers', 'calc-result', 'calc-gamblers', 'disp-pop-impact-zones', 'disp-pop-adults'];
        idsToZero.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = "0"; });
        window.dispatchEvent(new Event('map-state-reset'));
    }

    /**
     * Setup overlay controls (fullscreen button + risk zone legend)
     */
    function setupOverlayControls(container)
    {
        // Fullscreen toggle button - TOP RIGHT corner of map container's parent (which has position: relative)
        const fsBtn = document.createElement('button');
        fsBtn.id = 'fs-toggle-btn';
        fsBtn.title = 'Toggle Fullscreen';
        fsBtn.style.cssText = 'position: absolute; top: 12px; right: 12px; z-index: 70;';
        fsBtn.className = 'bg-slate-950/40 backdrop-blur-sm w-[30px] h-[30px] flex items-center justify-center rounded-lg shadow-lg border border-white/5 text-white hover:bg-slate-900/60 transition-colors cursor-pointer';
        fsBtn.innerHTML = '<span class="material-symbols-outlined text-xl leading-none">fullscreen</span>';
        fsBtn.onclick = function ()
        {
            const mapEl = container.parentElement;
            if (!document.fullscreenElement)
            {
                mapEl.requestFullscreen().catch(err => console.log(`Fullscreen error: ${err.message}`));
            } else
            {
                document.exitFullscreen();
            }
        };
        container.parentElement.appendChild(fsBtn);

        // Legend labels - positioned on RIGHT side, two-column layout: label left, value right
        const labelStack = document.createElement('div');
        labelStack.id = 'map-overlay-topright';
        labelStack.style.cssText = 'position: absolute; top: 80px; right: 12px; z-index: 60; display: flex; flex-direction: column; gap: 8px;';
        labelStack.innerHTML = `
            <div style="min-width: 160px; display: flex; justify-content: space-between; align-items: center;" class="bg-blue-600/40 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 cursor-pointer"><span>High Risk:</span><span id="label-high-val">-</span></div>
            <div style="min-width: 160px; display: flex; justify-content: space-between; align-items: center;" class="bg-red-600/40 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 cursor-pointer"><span>Elevated:</span><span id="label-elevated-val">-</span></div>
            <div style="min-width: 160px; display: flex; justify-content: space-between; align-items: center;" class="bg-orange-600/40 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-300 transform hover:scale-105 cursor-pointer"><span>Baseline:</span><span id="label-baseline-val">-</span></div>
        `;
        container.parentElement.appendChild(labelStack);

        // Fullscreen change handler
        document.addEventListener('fullscreenchange', () =>
        {
            const btn = document.getElementById('fs-toggle-btn');
            if (btn)
            {
                if (document.fullscreenElement)
                {
                    btn.innerHTML = '<span class="material-symbols-outlined text-xl leading-none">fullscreen_exit</span>';
                    if (map) map.scrollZoom.enable();
                } else
                {
                    btn.innerHTML = '<span class="material-symbols-outlined text-xl leading-none">fullscreen</span>';
                    if (map) map.scrollZoom.disable();
                }
            }
        });
    }

    /**
     * Setup layer switcher control (Google Maps style thumbnails - collapsible)
     */
    function setupLayerSwitcher(container)
    {
        // Container for layer button + cards (positioned left of zoom controls)
        const wrapper = document.createElement('div');
        wrapper.id = 'layer-switcher-wrapper';
        wrapper.style.cssText = 'position: absolute; bottom: 12px; right: 90px; z-index: 60; display: flex; align-items: center; gap: 8px;';

        // Layer toggle button
        const layerBtn = document.createElement('button');
        layerBtn.id = 'layer-toggle-btn';
        layerBtn.title = 'Change Map Style';
        layerBtn.className = 'bg-slate-950/40 backdrop-blur-sm w-[30px] h-[30px] flex items-center justify-center rounded-lg shadow-lg border border-white/5 text-white hover:bg-slate-900/60 transition-colors cursor-pointer';
        layerBtn.innerHTML = '<span class="material-symbols-outlined text-xl leading-none">layers</span>';

        // Cards container (hidden by default)
        const cardsContainer = document.createElement('div');
        cardsContainer.id = 'layer-cards';
        cardsContainer.style.cssText = 'display: none; flex-direction: row; gap: 6px; align-items: center;';

        Object.entries(BASEMAPS).forEach(([key, config]) =>
        {
            const card = document.createElement('button');
            card.className = `layer-card ${key === currentBasemap ? 'active' : ''}`;
            card.dataset.basemap = key;
            card.title = config.name;
            card.innerHTML = `
                <span class="material-symbols-outlined">${config.icon}</span>
                <span class="layer-card-label">${config.name}</span>
            `;
            card.onclick = (e) =>
            {
                e.stopPropagation();
                switchBasemap(key);
            };
            cardsContainer.appendChild(card);
        });

        wrapper.appendChild(cardsContainer);
        wrapper.appendChild(layerBtn);
        container.parentElement.appendChild(wrapper);

        // Toggle cards visibility
        let cardsVisible = false;
        layerBtn.onclick = (e) =>
        {
            e.stopPropagation();
            cardsVisible = !cardsVisible;
            cardsContainer.style.display = cardsVisible ? 'flex' : 'none';
            layerBtn.classList.toggle('active', cardsVisible);
        };

        // Close on click outside
        document.addEventListener('click', (e) =>
        {
            if (!wrapper.contains(e.target) && cardsVisible)
            {
                cardsVisible = false;
                cardsContainer.style.display = 'none';
                layerBtn.classList.remove('active');
            }
        });

        // Add CSS if not exists
        if (!document.getElementById('layer-switcher-styles'))
        {
            const style = document.createElement('style');
            style.id = 'layer-switcher-styles';
            style.textContent = `
                .layer-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 52px;
                    height: 52px;
                    background: rgba(15, 23, 42, 0.85);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: rgba(255, 255, 255, 0.7);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 9px;
                    gap: 2px;
                }
                .layer-card:hover {
                    background: rgba(30, 41, 59, 0.95);
                    border-color: rgba(255, 255, 255, 0.2);
                    color: white;
                    transform: scale(1.05);
                }
                .layer-card.active {
                    background: rgba(59, 130, 246, 0.5);
                    border-color: rgba(59, 130, 246, 0.7);
                    color: white;
                }
                .layer-card .material-symbols-outlined {
                    font-size: 18px;
                }
                .layer-card-label {
                    font-weight: 500;
                    white-space: nowrap;
                }
                #layer-toggle-btn.active {
                    background: rgba(59, 130, 246, 0.4) !important;
                    border-color: rgba(59, 130, 246, 0.5) !important;
                }
                /* Horizontal zoom controls */
                .maplibregl-ctrl-group.maplibregl-ctrl {
                    display: flex !important;
                    flex-direction: row !important;
                }
                .maplibregl-ctrl-group button {
                    border-bottom: none !important;
                    border-right: 1px solid rgba(255,255,255,0.05) !important;
                }
                .maplibregl-ctrl-group button:last-child {
                    border-right: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Setup hamburger menu control (slide-out drawer)
     */
    function setupHamburgerMenu(container)
    {
        // Hamburger button
        const menuBtn = document.createElement('button');
        menuBtn.id = 'map-menu-btn';
        menuBtn.title = 'Layer Options';
        menuBtn.style.cssText = 'position: absolute; top: 12px; left: 12px; z-index: 70;';
        menuBtn.className = 'bg-slate-950/40 backdrop-blur-sm w-[30px] h-[30px] flex items-center justify-center rounded-lg shadow-lg border border-white/5 text-white hover:bg-slate-900/60 transition-colors cursor-pointer';
        menuBtn.innerHTML = '<span class="material-symbols-outlined text-xl leading-none">menu</span>';
        container.parentElement.appendChild(menuBtn);

        // Slide-out panel
        const panel = document.createElement('div');
        panel.id = 'map-options-panel';
        panel.className = 'map-options-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">Map Options</span>
                <button id="close-panel-btn" class="close-btn">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="panel-section">
                <span class="section-label">Overlays</span>
                <label class="toggle-row">
                    <span>Impact Zones</span>
                    <input type="checkbox" id="toggle-zones" checked />
                    <span class="toggle-slider"></span>
                </label>
                <label class="toggle-row">
                    <span>County Boundaries</span>
                    <input type="checkbox" id="toggle-boundary" checked />
                    <span class="toggle-slider"></span>
                </label>
                <label class="toggle-row">
                    <span>Heatmap</span>
                    <input type="checkbox" id="toggle-heatmap" />
                    <span class="toggle-slider"></span>
                </label>
                <label class="toggle-row">
                    <span>Drive-Time Isochrones</span>
                    <input type="checkbox" id="toggle-isochrones" />
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="panel-section">
                <span class="section-label">3D Features</span>
                <label class="toggle-row">
                    <span>3D Terrain</span>
                    <input type="checkbox" id="toggle-terrain3d" />
                    <span class="toggle-slider"></span>
                </label>
                <label class="toggle-row">
                    <span>3D Buildings</span>
                    <input type="checkbox" id="toggle-buildings3d" />
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
        container.parentElement.appendChild(panel);

        // Panel toggle logic
        menuBtn.onclick = () => panel.classList.add('open');
        document.getElementById('close-panel-btn').onclick = () => panel.classList.remove('open');

        // Close on click outside
        document.addEventListener('click', (e) =>
        {
            if (!panel.contains(e.target) && !menuBtn.contains(e.target))
            {
                panel.classList.remove('open');
            }
        });

        // Toggle handlers
        const toggles = {
            'toggle-zones': 'zones',
            'toggle-boundary': 'boundary',
            'toggle-heatmap': 'heatmap',
            'toggle-isochrones': 'isochrones',
            'toggle-terrain3d': 'terrain3d',
            'toggle-buildings3d': 'buildings3d'
        };

        Object.entries(toggles).forEach(([id, layer]) =>
        {
            const checkbox = document.getElementById(id);
            if (checkbox)
            {
                checkbox.checked = layersVisible[layer];
                checkbox.onchange = () => toggleLayerVisibility(layer, checkbox.checked);
            }
        });

        // Add panel CSS if not exists
        if (!document.getElementById('hamburger-menu-styles'))
        {
            const style = document.createElement('style');
            style.id = 'hamburger-menu-styles';
            style.textContent = `
                .map-options-panel {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 220px;
                    height: 100%;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(12px);
                    border-right: 1px solid rgba(255, 255, 255, 0.1);
                    z-index: 80;
                    transform: translateX(-100%);
                    transition: transform 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    color: white;
                }
                .map-options-panel.open {
                    transform: translateX(0);
                }
                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                .panel-title {
                    font-weight: 600;
                    font-size: 14px;
                }
                .close-btn {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.6);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                }
                .close-btn:hover { color: white; }
                .panel-section {
                    padding: 12px 16px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .section-label {
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: rgba(255, 255, 255, 0.4);
                    margin-bottom: 8px;
                    display: block;
                }
                .toggle-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    font-size: 13px;
                    cursor: pointer;
                    position: relative;
                }
                .toggle-row input[type="checkbox"] {
                    appearance: none;
                    width: 36px;
                    height: 20px;
                    background: rgba(100, 116, 139, 0.5);
                    border-radius: 10px;
                    position: relative;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .toggle-row input[type="checkbox"]:checked {
                    background: rgba(59, 130, 246, 0.7);
                }
                .toggle-row input[type="checkbox"]::before {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    transition: transform 0.2s;
                }
                .toggle-row input[type="checkbox"]:checked::before {
                    transform: translateX(16px);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Switch basemap style
     */
    async function switchBasemap(basemapKey)
    {
        if (basemapKey === currentBasemap) return;

        const config = BASEMAPS[basemapKey];
        if (!config) return;

        // Store current state
        const center = map.getCenter();
        const zoom = map.getZoom();
        const pitch = map.getPitch();
        const bearing = map.getBearing();

        currentBasemap = basemapKey;

        // Update active card
        document.querySelectorAll('.layer-card').forEach(card =>
        {
            card.classList.toggle('active', card.dataset.basemap === basemapKey);
        });

        // Switch style
        map.setStyle(config.style);

        // Restore state after style loads
        map.once('style.load', async () =>
        {
            map.setCenter(center);
            map.setZoom(zoom);
            map.setPitch(pitch);
            map.setBearing(bearing);

            // Re-add all custom layers
            setupCircleLayers();
            setupHeatmapLayer();
            setupIsochroneLayers();

            // Re-add terrain if enabled
            if (layersVisible.terrain3d) enableTerrain3d(true);
            if (layersVisible.buildings3d) enable3dBuildings(true);

            // Reload state/county data
            const data = await loadStates();
            if (data) setupStateLayer(data);

            if (currentStateFips)
            {
                const countyData = await loadCounties(currentStateFips);
                setupCountyLayer(countyData);
                map.setLayoutProperty('counties-fill', 'visibility', 'visible');
                map.setLayoutProperty('counties-line', 'visibility', 'visible');
            }

            // Restore marker
            if (markerPosition)
            {
                marker = null; // Force recreation
                updateMarker(markerPosition);
                updateCircles(markerPosition);
            }
        });
    }

    /**
     * Toggle layer visibility with proper handling
     */
    function toggleLayerVisibility(layerType, visible)
    {
        layersVisible[layerType] = visible;

        switch (layerType)
        {
            case 'zones':
                ['circle-tier1-fill', 'circle-tier1-line', 'circle-tier2-fill', 'circle-tier2-line', 'circle-tier3-fill', 'circle-tier3-line']
                    .forEach(id => setLayerVisibility(id, visible));
                break;
            case 'boundary':
                ['counties-fill', 'counties-line', 'county-highlight-line'].forEach(id => setLayerVisibility(id, visible));
                break;
            case 'heatmap':
                setLayerVisibility('block-groups-heat', visible);
                break;
            case 'isochrones':
                setLayerVisibility('isochrone-fill', visible);
                setLayerVisibility('isochrone-line', visible);
                if (visible && markerPosition) updateIsochrones(markerPosition);
                break;
            case 'terrain3d':
                enableTerrain3d(visible);
                break;
            case 'buildings3d':
                enable3dBuildings(visible);
                break;
        }
    }

    /**
     * Enable/disable 3D terrain
     */
    function enableTerrain3d(enable)
    {
        if (!map) return;

        if (enable)
        {
            // Add terrain source if not exists
            if (!map.getSource('terrain-dem'))
            {
                map.addSource('terrain-dem', {
                    type: 'raster-dem',
                    url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
                    tileSize: 256
                });
            }

            map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });

            // Add sky layer for atmosphere
            if (!map.getLayer('sky'))
            {
                map.addLayer({
                    id: 'sky',
                    type: 'sky',
                    paint: {
                        'sky-type': 'atmosphere',
                        'sky-atmosphere-sun': [0.0, 90.0],
                        'sky-atmosphere-sun-intensity': 15
                    }
                });
            }

            // Tilt the map slightly for 3D effect
            map.easeTo({ pitch: 45, duration: 500 });
        } else
        {
            map.setTerrain(null);
            if (map.getLayer('sky')) map.removeLayer('sky');
            map.easeTo({ pitch: 0, duration: 500 });
        }
    }

    /**
     * Enable/disable 3D buildings (vector basemaps only)
     */
    function enable3dBuildings(enable)
    {
        if (!map) return;

        if (enable)
        {
            // Only works with vector basemaps
            if (currentBasemap === 'satellite' || currentBasemap === 'hybrid')
            {
                console.warn('3D buildings require Streets or Terrain basemap');
                return;
            }

            if (!map.getLayer('buildings-3d'))
            {
                // Try to add building layer if source has building data
                const layers = map.getStyle().layers;
                const buildingLayer = layers.find(l => l['source-layer'] === 'building');

                if (buildingLayer)
                {
                    map.addLayer({
                        id: 'buildings-3d',
                        type: 'fill-extrusion',
                        source: buildingLayer.source,
                        'source-layer': 'building',
                        filter: ['==', 'extrude', 'true'],
                        paint: {
                            'fill-extrusion-color': '#444',
                            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, ['get', 'height']],
                            'fill-extrusion-base': ['get', 'min_height'],
                            'fill-extrusion-opacity': 0.7
                        }
                    });
                }
            } else
            {
                map.setLayoutProperty('buildings-3d', 'visibility', 'visible');
            }
        } else
        {
            if (map.getLayer('buildings-3d'))
            {
                map.setLayoutProperty('buildings-3d', 'visibility', 'none');
            }
        }
    }

    // === LAYER SETUP ===

    function setupCircleLayers()
    {
        if (!map) return;
        map.addSource('impact-circles', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        [{ tier: 3, color: TIER_COLORS.tier3, opacity: 0.12, dash: [2, 6] },
        { tier: 2, color: TIER_COLORS.tier2, opacity: 0.35, dash: [5, 5] },
        { tier: 1, color: TIER_COLORS.tier1, opacity: 0.25, dash: null }].forEach(cfg =>
        {
            map.addLayer({
                id: `circle-tier${cfg.tier}-fill`, type: 'fill', source: 'impact-circles',
                filter: ['==', ['get', 'tier'], cfg.tier],
                paint: { 'fill-color': cfg.color, 'fill-opacity': cfg.opacity }
            });
            const linePaint = { 'line-color': cfg.color, 'line-width': 2 };
            if (cfg.dash) linePaint['line-dasharray'] = cfg.dash;
            map.addLayer({
                id: `circle-tier${cfg.tier}-line`, type: 'line', source: 'impact-circles',
                filter: ['==', ['get', 'tier'], cfg.tier], paint: linePaint
            });
        });
    }

    function setupHeatmapLayer()
    {
        if (!map) return;
        map.addSource('block-groups', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
            id: 'block-groups-heat', type: 'heatmap', source: 'block-groups',
            paint: {
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'POP_ADULT'], 0, 0, 5000, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 1, 15, 3],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 15, 15, 30],
                'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(178,226,226,0)', 0.2, '#ADD8E6', 0.4, '#FEB24C', 0.6, '#FC4E2A', 0.8, '#E31A1C', 1, '#800026'],
                'heatmap-opacity': 0.6
            }
        }, 'circle-tier3-fill');
    }

    function setupIsochroneLayers()
    {
        if (!map) return;
        map.addSource('isochrones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
            id: 'isochrone-fill', type: 'fill', source: 'isochrones',
            paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'contour'], 5, ISOCHRONE_COLORS[5], 15, ISOCHRONE_COLORS[15], 30, ISOCHRONE_COLORS[30]], 'fill-opacity': 0.3 }
        });
        map.addLayer({
            id: 'isochrone-line', type: 'line', source: 'isochrones',
            paint: { 'line-color': ['interpolate', ['linear'], ['get', 'contour'], 5, ISOCHRONE_COLORS[5], 15, ISOCHRONE_COLORS[15], 30, ISOCHRONE_COLORS[30]], 'line-width': 2 }
        });
    }

    function setupStateLayer(data)
    {
        if (!map) return;
        map.addSource('states', { type: 'geojson', data, promoteId: 'GEOID' });
        map.addLayer({ id: 'states-fill', type: 'fill', source: 'states', paint: { 'fill-color': '#94a3b8', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.3, 0.05] } });
        map.addLayer({ id: 'states-line', type: 'line', source: 'states', paint: { 'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#60a5fa', '#94a3b8'], 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 1] } });

        let hoveredStateId = null;
        map.on('mousemove', 'states-fill', (e) =>
        {
            if (e.features.length > 0)
            {
                if (hoveredStateId !== null) map.setFeatureState({ source: 'states', id: hoveredStateId }, { hover: false });
                hoveredStateId = e.features[0].id;
                map.setFeatureState({ source: 'states', id: hoveredStateId }, { hover: true });
                map.getCanvas().style.cursor = 'pointer';
            }
        });
        map.on('mouseleave', 'states-fill', () =>
        {
            if (hoveredStateId !== null) map.setFeatureState({ source: 'states', id: hoveredStateId }, { hover: false });
            hoveredStateId = null;
            map.getCanvas().style.cursor = '';
        });
        map.on('click', 'states-fill', (e) =>
        {
            if (e.features.length > 0) drillToState(e.features[0].properties.GEOID);
        });
    }

    async function drillToState(stateFips)
    {
        currentStateFips = stateFips;
        map.setLayoutProperty('states-fill', 'visibility', 'none');
        map.setLayoutProperty('states-line', 'visibility', 'none');

        countyData = await loadCounties(stateFips);
        if (map.getSource('counties')) map.getSource('counties').setData(countyData);
        else setupCountyLayer(countyData);

        map.setLayoutProperty('counties-fill', 'visibility', 'visible');
        map.setLayoutProperty('counties-line', 'visibility', 'visible');

        const stateFeature = stateData?.features.find(f => f.properties.GEOID === stateFips);
        if (stateFeature && typeof turf !== 'undefined')
        {
            const bounds = turf.bbox(stateFeature);
            map.fitBounds(bounds, { padding: 40 });
        }

        if (els.stateDisplay && stateFeature) els.stateDisplay.textContent = stateFeature.properties.NAME;
        updateMapNavUI(2);
    }

    function setupCountyLayer(data)
    {
        if (!map) return;
        map.addSource('counties', { type: 'geojson', data, promoteId: 'GEOID' });
        map.addLayer({ id: 'counties-fill', type: 'fill', source: 'counties', paint: { 'fill-color': '#94a3b8', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.3, 0.08] }, layout: { visibility: 'none' } });
        map.addLayer({ id: 'counties-line', type: 'line', source: 'counties', paint: { 'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#60a5fa', '#94a3b8'], 'line-width': 1 }, layout: { visibility: 'none' } });

        let hoveredId = null;
        map.on('mousemove', 'counties-fill', (e) =>
        {
            if (e.features.length > 0)
            {
                if (hoveredId !== null) map.setFeatureState({ source: 'counties', id: hoveredId }, { hover: false });
                hoveredId = e.features[0].id;
                map.setFeatureState({ source: 'counties', id: hoveredId }, { hover: true });
                map.getCanvas().style.cursor = 'pointer';
            }
        });
        map.on('mouseleave', 'counties-fill', () =>
        {
            if (hoveredId !== null) map.setFeatureState({ source: 'counties', id: hoveredId }, { hover: false });
            hoveredId = null;
            map.getCanvas().style.cursor = '';
        });
        map.on('click', 'counties-fill', (e) =>
        {
            if (e.features.length > 0) selectCounty(e.features[0].properties.GEOID);
        });
    }

    async function selectCounty(countyFips)
    {
        currentCountyFips = countyFips;
        const countyFeature = countyData?.features.find(f => f.properties.GEOID === countyFips);

        await loadCountyContext(countyFips, true);

        if (countyFeature && typeof turf !== 'undefined')
        {
            const center = turf.center(countyFeature).geometry.coordinates;
            markerPosition = { lng: center[0], lat: center[1] };
            updateMarker(markerPosition);
            updateCircles(markerPosition);
            const circle50 = createCircleGeoJSON([center[0], center[1]], CIRCLE_RADII.tier3);
            map.fitBounds(turf.bbox(circle50), { padding: 20 });
            highlightCounty(countyFeature);
        }

        calculateImpact();

        if (els.displayCounty && countyFeature) els.displayCounty.textContent = countyFeature.properties.NAME;
        window.dispatchEvent(new CustomEvent('county-selected-map', { detail: { geoid: countyFips, name: countyFeature?.properties.NAME } }));
        updateMapNavUI(3);
    }

    function updateMarker(lngLat)
    {
        if (!map) return;
        if (marker)
        {
            marker.setLngLat([lngLat.lng, lngLat.lat]);
            return;
        }
        const el = document.createElement('div');
        el.style.cssText = 'width:50px;height:88px;cursor:grab;background:url(assets/Casino_Map_Marker.svg) no-repeat center/contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.4));';

        // Click to zoom handler
        el.addEventListener('click', (e) =>
        {
            if (!e.defaultPrevented && markerPosition)
            {
                map.flyTo({ center: [markerPosition.lng, markerPosition.lat], zoom: 10, duration: 800 });
            }
        });

        marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true, scale: 1 })
            .setLngLat([lngLat.lng, lngLat.lat])
            .addTo(map);
        marker.on('drag', () =>
        {
            const pos = marker.getLngLat();
            markerPosition = pos;
            updateCircles(pos);

            // Check if marker moved to a new county
            if (countyData && countyData.features)
            {
                const pt = turf.point([pos.lng, pos.lat]);
                const matched = countyData.features.find(f => turf.booleanPointInPolygon(pt, f));
                if (matched)
                {
                    const newCountyFips = matched.properties.GEOID || matched.properties.geoid;
                    if (newCountyFips && newCountyFips !== currentCountyFips)
                    {
                        currentCountyFips = newCountyFips;
                        loadCountyContext(newCountyFips).then(() =>
                        {
                            calculateImpact();
                        });
                        highlightCounty(matched);
                        const cInfo = countyReference.find(c => c.geoid === newCountyFips);
                        if (cInfo)
                        {
                            window.dispatchEvent(new CustomEvent('county-selected-map', { detail: { name: cInfo.name, pop: cInfo.pop, geoid: newCountyFips } }));
                            const displayEl = document.getElementById('county-display');
                            if (displayEl) displayEl.textContent = cInfo.name;
                        }
                        // Don't call calculateImpact here - wait for context to load
                        if (layersVisible.isochrones) updateIsochrones(pos);
                        return; // Exit early, calculateImpact will be called after context loads
                    }
                }
            }

            calculateImpact();
            if (layersVisible.isochrones) updateIsochrones(pos);
        });
        marker.on('dragstart', () => { el.style.cursor = 'grabbing'; });
        marker.on('dragend', () => { el.style.cursor = 'grab'; });
    }

    function highlightCounty(feature)
    {
        if (!map) return;
        const src = map.getSource('county-highlight');
        if (src) src.setData(feature);
        else
        {
            map.addSource('county-highlight', { type: 'geojson', data: feature });
            map.addLayer({ id: 'county-highlight-line', type: 'line', source: 'county-highlight', paint: { 'line-color': '#fff', 'line-width': 3, 'line-dasharray': [1, 2] } });
        }
    }

    function setLayerVisibility(id, visible)
    {
        if (!map || !map.getLayer(id)) return;
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }

    // === PUBLIC API ===

    return {
        init: async function (containerId, options = {})
        {
            const container = document.getElementById(containerId);
            if (!container) { console.error('MapLibre: Container not found'); return; }

            els = {
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
                inputRate: document.getElementById('input-rate'),
                stateDisplay: document.getElementById('state-display'),
                displayCounty: document.getElementById('display-impact-county')
            };

            if (typeof pmtiles !== 'undefined')
            {
                const protocol = new pmtiles.Protocol();
                maplibregl.addProtocol('pmtiles', protocol.tile);
            }

            map = new maplibregl.Map({
                container: containerId,
                style: options.style || { version: 8, sources: { 'raster-tiles': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles' }] },
                center: options.center || DEFAULT_CENTER,
                zoom: options.zoom || DEFAULT_ZOOM,
                scrollZoom: false,
                attributionControl: false
            });

            map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

            map.on('load', async () =>
            {
                setupCircleLayers();
                setupHeatmapLayer();
                setupIsochroneLayers();
                const data = await loadStates();
                if (data) setupStateLayer(data);
                updateMapNavUI(1);
                console.log('MapLibreImpactMap v2.0 initialized');
            });

            // Add overlay controls (fullscreen button + legend)
            setupOverlayControls(container);

            // Add layer switcher and hamburger menu
            setupLayerSwitcher(container);
            setupHamburgerMenu(container);

            // CTRL + Scroll zoom handling - use native scroll zoom when CTRL is held
            let ctrlPressed = false;

            // Enable/disable scroll zoom based on CTRL key
            document.addEventListener('keydown', (e) =>
            {
                if (e.key === 'Control' && !ctrlPressed && !document.fullscreenElement)
                {
                    ctrlPressed = true;
                    map.scrollZoom.enable();
                }
            });

            document.addEventListener('keyup', (e) =>
            {
                if (e.key === 'Control' && ctrlPressed && !document.fullscreenElement)
                {
                    ctrlPressed = false;
                    map.scrollZoom.disable();
                }
            });

            // Show hint when scrolling without CTRL
            container.addEventListener('wheel', (e) =>
            {
                if (document.fullscreenElement) return;
                if (ctrlPressed) return; // Let native zoom handle it

                const hint = document.getElementById('map-zoom-hint');
                if (hint)
                {
                    hint.style.opacity = '1';
                    clearTimeout(hint._hideTimeout);
                    hint._hideTimeout = setTimeout(() => { hint.style.opacity = '0'; }, 1500);
                }
            }, { passive: true });

            // CTRL + Plus/Minus keyboard zoom
            container.setAttribute('tabindex', '0');
            container.addEventListener('keydown', (e) =>
            {
                if (document.fullscreenElement) return;
                if (!e.ctrlKey) return;

                if (e.key === '+' || e.key === '=')
                {
                    e.preventDefault();
                    map.zoomIn({ duration: 300 });
                } else if (e.key === '-' || e.key === '_')
                {
                    e.preventDefault();
                    map.zoomOut({ duration: 300 });
                }
            });

            new ResizeObserver(() => map?.resize()).observe(container);

            if (els.inputRate) els.inputRate.addEventListener('input', () => calculateImpact());
            return map;
        },

        toggleLayer: function (type)
        {
            layersVisible[type] = !layersVisible[type];
            if (type === 'zones') ['circle-tier1-fill', 'circle-tier1-line', 'circle-tier2-fill', 'circle-tier2-line', 'circle-tier3-fill', 'circle-tier3-line'].forEach(id => setLayerVisibility(id, layersVisible.zones));
            if (type === 'heatmap') setLayerVisibility('block-groups-heat', layersVisible.heatmap);
            if (type === 'isochrones') { setLayerVisibility('isochrone-fill', layersVisible.isochrones); setLayerVisibility('isochrone-line', layersVisible.isochrones); if (layersVisible.isochrones && markerPosition) updateIsochrones(markerPosition); }
        },

        navigateToStep: function (step)
        {
            if (step === 1)
            {
                // Reset state
                currentStateFips = null;
                currentCountyFips = null;
                markerPosition = null;
                resetImpactStats();

                // Remove marker if exists
                if (marker)
                {
                    marker.remove();
                    marker = null;
                }

                // Clear circles
                if (map.getSource('impact-circles'))
                {
                    map.getSource('impact-circles').setData({ type: 'FeatureCollection', features: [] });
                }

                // Show state layers
                setLayerVisibility('states-fill', true);
                setLayerVisibility('states-line', true);

                // Hide county layers
                setLayerVisibility('counties-fill', false);
                setLayerVisibility('counties-line', false);
                setLayerVisibility('county-highlight-line', false);

                // Fly to nationwide view
                map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
                updateMapNavUI(1);
            }
            else if (step === 2 && currentStateFips) drillToState(currentStateFips);
        },

        getMarkerPosition: () => markerPosition,
        getMap: () => map,
        loadState: (fips) => drillToState(fips),
        loadCounty: (fips) => selectCounty(fips),
        setIsochroneVisibility: (v) => { layersVisible.isochrones = v; setLayerVisibility('isochrone-fill', v); setLayerVisibility('isochrone-line', v); if (v && markerPosition) updateIsochrones(markerPosition); }
    };
})();

// === GLOBAL HELPERS (for HTML onclick handlers) ===

window.toggleLayer = function (id)
{
    const cb = document.getElementById('layer-' + id);
    if (cb && window.MapLibreImpactMap)
    {
        window.MapLibreImpactMap.toggleLayer(id);
    }
};

// Alias for backward compatibility
window.ImpactMap = window.MapLibreImpactMap;


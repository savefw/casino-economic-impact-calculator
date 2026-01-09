window.PdfHelper = {
    captureMapAndGenerate: async function(mapElementId) {
        // 1. Target elements to hide
        const elementsToHide = [
            document.getElementById('map-navigation-overlay'),
            document.querySelector('#map-zoom-hint'),
            document.querySelector('#map-overlay-panel'),
            document.querySelector('#map-overlay-topright'),
            document.querySelector('button[onclick="toggleMapOverlay()"]'),
            document.querySelector('.leaflet-control-zoom'),
            document.querySelector('.leaflet-control-attribution'),
            document.querySelector('.leaflet-control-container .leaflet-top.leaflet-left') // Often contains zoom
        ];

        // 2. Hide them
        const originalStyles = new Map();
        elementsToHide.forEach(el => {
            if (el) {
                originalStyles.set(el, el.style.display);
                el.style.display = 'none';
            }
        });

        // 3. Snapshot
        const mapElement = document.getElementById(mapElementId);
        let base64 = null;
        
        if (mapElement) {
            try {
                // Use html2canvas
                const canvas = await html2canvas(mapElement, {
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    scale: 2 // Higher resolution
                });
                
                base64 = canvas.toDataURL("image/png");
            } catch (err) {
                console.error("Map capture failed:", err);
            }
        }

        // 4. Restore
        elementsToHide.forEach(el => {
            if (el) {
                el.style.display = originalStyles.get(el);
            }
        });
        
        return base64;
    },
    
    downloadFileFromStream: async function(filename, contentStreamReference) {
        const arrayBuffer = await contentStreamReference.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const anchorElement = document.createElement('a');
        anchorElement.href = url;
        anchorElement.download = filename ?? '';
        anchorElement.click();
        anchorElement.remove();
        URL.revokeObjectURL(url);
    },

    // Scrape data for report
    getReportData: function() {
        // Scrape Analysis Text
        const analysisEl = document.getElementById('analysis-text');
        const analysisText = analysisEl ? analysisEl.innerText : "";

        // Scrape Data Table
        // The net impact table might be dynamic HTML.
        // We can try to scrape values from the IDs we know exist in EconomicImpact.razor
        // like "val-agr", "val-revenue", "val-cost-total", etc.
        // Or if there is a generated table #net-impact-table.
        
        // Let's scrape key IDs based on the Razor file
        const data = {};
        
        const idsToScrape = [
            { id: 'val-agr', name: 'Adjusted Gross Revenue' },
            { id: 'val-revenue', name: 'Tax Revenue' },
            { id: 'val-cost-total', name: 'Social Cost Per Gambler' },
            { id: 'val-cost-crime', name: 'Crime Costs' },
            { id: 'val-cost-business', name: 'Lost Employment' },
            { id: 'val-cost-bankruptcy', name: 'Bankruptcy' },
            { id: 'val-cost-illness', name: 'Illness' },
            { id: 'val-cost-services', name: 'Social Services' },
            { id: 'val-cost-abused', name: 'Abused Dollars' },
            // Calculated totals
            { id: 'calc-tax-total', name: 'Total Estimated Tax Revenue' },
            { id: 'calc-result', name: 'New Problem Gamblers (Calculated)' },
            { id: 'calc-total-cost-combined', name: 'Total Social Cost (Subject County)' },
            { id: 'total-gamblers', name: 'Total Net New Problem Gamblers' }
        ];

        idsToScrape.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) {
                data[item.name] = el.innerText;
            }
        });

        return {
            analysisText: analysisText,
            tableData: data
        };
    }
};

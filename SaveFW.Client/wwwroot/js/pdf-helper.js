window.PdfHelper = {
    captureMapAndGenerate: async function(mapElementId) {
        // 1. Target elements to hide (UI Controls ONLY)
        const elementsToHide = [
            document.getElementById('map-navigation-overlay'),
            document.querySelector('#map-zoom-hint'),
            document.querySelector('#map-overlay-panel'),
            document.querySelector('#map-overlay-topright'), // Toggles & Risk Tags
            document.querySelector('button[onclick="toggleMapOverlay()"]'), // Layer Toggle
            // Leaflet Controls (Zoom buttons, Attribution) - Keep markers/lines!
            document.querySelector('.leaflet-control-container .leaflet-top.leaflet-left'), 
            document.querySelector('.leaflet-control-container .leaflet-bottom.leaflet-right')
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
                // Ensure SVG rendering is enabled
                const canvas = await html2canvas(mapElement, {
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    scale: 2, // High resolution
                    ignoreElements: (element) => {
                        // Double check we don't capture hidden UI if html2canvas sees them
                        if (elementsToHide.includes(element)) return true;
                        return false;
                    }
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

    getReportData: function() {
        // 1. Scrape Main Table (Net Economic Impact)
        const table = document.querySelector('#net-impact-table table');
        let mainTableData = { headers: [], rows: [] };
        
        if (table) {
            // Headers
            const ths = Array.from(table.querySelectorAll('thead th'));
            mainTableData.headers = ths.map(th => th.innerText.trim());
            
            // Rows
            const trs = Array.from(table.querySelectorAll('tbody tr'));
            mainTableData.rows = trs.map(tr => {
                const cells = Array.from(tr.querySelectorAll('td'));
                return cells.map(td => td.innerText.trim().replace(/[\n\r]+|info/g, ' ')); // Clean up tooltips/newlines
            });
        }

        // 2. Scrape Supplementary Tables (Breakdowns)
        const getRow = (label, idVictims, idPer, idTotal) => {
            return [
                label,
                document.getElementById(idVictims)?.innerText || "-",
                document.getElementById(idPer)?.innerText || "-",
                document.getElementById(idTotal)?.innerText || "-"
            ];
        };

        // Subject County Breakdown
        const breakdownData = [
            getRow("Public Health", "calc-break-health-victims", "calc-break-health-per", "calc-break-health-total"),
            getRow("Social Services", "calc-break-social-victims", "calc-break-social-per", "calc-break-social-total"),
            getRow("Law Enforcement", "calc-break-crime-victims", "calc-break-crime-per", "calc-break-crime-total"),
            getRow("Civil Legal", "calc-break-legal-victims", "calc-break-legal-per", "calc-break-legal-total"),
            getRow("Abused Dollars", "calc-break-abused-victims", "calc-break-abused-per", "calc-break-abused-total"),
            getRow("Lost Employment", "calc-break-employment-victims", "calc-break-employment-per", "calc-break-employment-total"),
            getRow("Total", "calc-break-total-victims", "calc-total-cost-per", "calc-total-cost-combined")
        ];

        // Other Counties Breakdown
        const breakdownOtherData = [
            getRow("Public Health", "calc-break-health-victims-other", "calc-break-health-per-other", "calc-break-health-total-other"),
            getRow("Social Services", "calc-break-social-victims-other", "calc-break-social-per-other", "calc-break-social-total-other"),
            getRow("Law Enforcement", "calc-break-crime-victims-other", "calc-break-crime-per-other", "calc-break-crime-total-other"),
            getRow("Civil Legal", "calc-break-legal-victims-other", "calc-break-legal-per-other", "calc-break-legal-total-other"),
            getRow("Abused Dollars", "calc-break-abused-victims-other", "calc-break-abused-per-other", "calc-break-abused-total-other"),
            getRow("Lost Employment", "calc-break-employment-victims-other", "calc-break-employment-per-other", "calc-break-employment-total-other"),
            getRow("Total", "calc-break-total-victims-other", "calc-total-cost-per-other", "calc-total-cost-combined-other")
        ];

        // Scrape Analysis Text
        const analysisEl = document.getElementById('analysis-text');
        let formattedText = "";
        
        if (analysisEl) {
            // Helper to process nodes recursively-ish or just handle known structure
            // The structure is flat: div (header), ul (list), div (header), ul (list)...
            
            for (const node of analysisEl.childNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'DIV' && node.classList.contains('font-bold')) {
                        // Section Header
                        formattedText += `### ${node.innerText.trim()}\n`;
                    } else if (node.tagName === 'UL') {
                        // List
                        const lis = node.querySelectorAll('li');
                        lis.forEach(li => {
                            // Handle inner bold
                            let liText = li.innerHTML;
                            // Replace <strong> or <b> with **text**
                            liText = liText.replace(/<(strong|b)>(.*?)<\/\1>/gi, "**$2**");
                            // Remove other tags (like links) but keep text
                            liText = liText.replace(/<[^>]+>/g, ""); // naive strip tags
                            // Decode entities if needed (browser handles innerHTML mostly, but let's be safe with simple text)
                            // Actually, let's use a temporary element to decode entities but preserve our ** markers
                            const temp = document.createElement('div');
                            temp.innerHTML = liText;
                            formattedText += `* ${temp.innerText.trim()}\n`;
                        });
                        formattedText += "\n";
                    } else if (node.tagName === 'P') {
                        formattedText += `${node.innerText.trim()}\n\n`;
                    }
                }
            }
        }

        return {
            analysisText: formattedText,
            mainTable: mainTableData,
            breakdownTable: breakdownData,
            breakdownOtherTable: breakdownOtherData
        };
    }
};
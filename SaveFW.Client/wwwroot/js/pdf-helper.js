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
            const ths = Array.from(table.querySelectorAll('thead th'));
            mainTableData.headers = ths.map(th => th.innerText.trim());
            const trs = Array.from(table.querySelectorAll('tbody tr'));
            mainTableData.rows = trs.map(tr => {
                const cells = Array.from(tr.querySelectorAll('td'));
                return cells.map(td => td.innerText.trim().replace(/[\n\r]+|info/g, ' '));
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

        const breakdownSubjectData = [
            getRow("Public Health", "calc-break-health-victims", "calc-break-health-per", "calc-break-health-total"),
            getRow("Social Services", "calc-break-social-victims", "calc-break-social-per", "calc-break-social-total"),
            getRow("Law Enforcement", "calc-break-crime-victims", "calc-break-crime-per", "calc-break-crime-total"),
            getRow("Civil Legal", "calc-break-legal-victims", "calc-break-legal-per", "calc-break-legal-total"),
            getRow("Abused Dollars", "calc-break-abused-victims", "calc-break-abused-per", "calc-break-abused-total"),
            getRow("Lost Employment", "calc-break-employment-victims", "calc-break-employment-per", "calc-break-employment-total"),
            getRow("Total", "calc-break-total-victims", "calc-total-cost-per", "calc-total-cost-combined")
        ];

        const breakdownOtherData_Scraped = [
            getRow("Public Health", "calc-break-health-victims-other", "calc-break-health-per-other", "calc-break-health-total-other"),
            getRow("Social Services", "calc-break-social-victims-other", "calc-break-social-per-other", "calc-break-social-total-other"),
            getRow("Law Enforcement", "calc-break-crime-victims-other", "calc-break-crime-per-other", "calc-break-crime-total-other"),
            getRow("Civil Legal", "calc-break-legal-victims-other", "calc-break-legal-per-other", "calc-break-legal-total-other"),
            getRow("Abused Dollars", "calc-break-abused-victims-other", "calc-break-abused-per-other", "calc-break-abused-total-other"),
            getRow("Lost Employment", "calc-break-employment-victims-other", "calc-break-employment-per-other", "calc-break-employment-total-other"),
            getRow("Total", "calc-break-total-victims-other", "calc-total-cost-per-other", "calc-total-cost-combined-other")
        ];

        // 3. Scrape Analysis Text (Markdown-ish)
        const analysisEl = document.getElementById('analysis-text');
        let formattedText = "";
        
        if (analysisEl) {
            for (const node of analysisEl.childNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'DIV' && node.classList.contains('font-bold')) {
                        formattedText += `### ${node.innerText.trim()}\n`;
                    } else if (node.tagName === 'UL') {
                        const lis = node.querySelectorAll('li');
                        lis.forEach(li => {
                            let liText = li.innerHTML;
                            liText = liText.replace(/<(strong|b)>(.*?)<\/\1>/gi, "**$2**");
                            liText = liText.replace(/<[^>]+>/g, "");
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

        // 4. Retrieve Detailed Calc Data
        let calcData = null;
        if (window.EconomicCalculator && window.EconomicCalculator.getLastCalculationData) {
            calcData = window.EconomicCalculator.getLastCalculationData();
        }

        const subjectCountyName = (calcData && calcData.subjectCountyName) ? calcData.subjectCountyName : null;

        // 5. Build Final Other Breakdown
        let breakdownOtherData = [];
        const fmtM = (v) => '$' + (v / 1000000).toFixed(1) + 'MM';
        
        if (calcData && calcData.otherCosts && Array.isArray(calcData.otherCosts.counties) && calcData.otherCosts.counties.length > 0) {
            const counties = calcData.otherCosts.counties;
            breakdownOtherData = counties.map(c => {
                return [
                    c.name + " County",
                    fmtM(c.costs.health),
                    fmtM(c.costs.social),
                    fmtM(c.costs.crime),
                    fmtM(c.costs.legal),
                    fmtM(c.costs.abused),
                    fmtM(c.costs.employment),
                    fmtM(c.costs.total)
                ];
            });
        } else {
            // Use scraped summary if detailed data missing (fallback)
            // But scraped data is [Category, Victims, Per, Total] (rows).
            // We need to transpose it to fit the new table structure [Name, PH, SS, ...]
            // The scraped data is just ONE row of values effectively (the "Regional Spillover" aggregate).
            // Let's manually construct a single summary row from the scraped data to fit the new schema.
            // Scraped indices: 0=PH, 1=SS, 2=Law, 3=Legal, 4=Abused, 5=Emp, 6=Total.
            // Value is at index 3 of each row.
            const val = (idx) => breakdownOtherData_Scraped[idx][3];
            
            breakdownOtherData = [[
                "Regional Spillover (Summary)",
                val(0), val(1), val(2), val(3), val(4), val(5), val(6)
            ]];
        }

        return {
            subjectCountyName: subjectCountyName,
            analysisText: formattedText,
            mainTable: mainTableData,
            breakdownTable: breakdownSubjectData,
            breakdownOtherTable: breakdownOtherData
        };
    }
};
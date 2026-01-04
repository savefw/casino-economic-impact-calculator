window.EconomicCalculator = (function ()
{
    const countyData = [
        { id: "001", name: "Adams", pop: 35809 },
        { id: "003", name: "Allen", pop: 385410 },
        { id: "005", name: "Bartholomew", pop: 82208 },
        { id: "007", name: "Benton", pop: 8719 },
        { id: "009", name: "Blackford", pop: 12112 },
        { id: "011", name: "Boone", pop: 70812 },
        { id: "013", name: "Brown", pop: 15475 },
        { id: "015", name: "Carroll", pop: 20306 },
        { id: "017", name: "Cass", pop: 37870 },
        { id: "019", name: "Clark", pop: 121093 },
        { id: "021", name: "Clay", pop: 26466 },
        { id: "023", name: "Clinton", pop: 33190 },
        { id: "025", name: "Crawford", pop: 10526 },
        { id: "027", name: "Daviess", pop: 33381 },
        { id: "029", name: "Dearborn", pop: 50679 },
        { id: "031", name: "Decatur", pop: 26472 },
        { id: "033", name: "DeKalb", pop: 43265 },
        { id: "035", name: "Delaware", pop: 111903 },
        { id: "037", name: "Dubois", pop: 43637 },
        { id: "039", name: "Elkhart", pop: 207047 },
        { id: "041", name: "Fayette", pop: 23398 },
        { id: "043", name: "Floyd", pop: 80484 },
        { id: "045", name: "Fountain", pop: 16479 },
        { id: "047", name: "Franklin", pop: 22785 },
        { id: "049", name: "Fulton", pop: 20480 },
        { id: "051", name: "Gibson", pop: 33011 },
        { id: "053", name: "Grant", pop: 66674 },
        { id: "055", name: "Greene", pop: 30803 },
        { id: "057", name: "Hamilton", pop: 347467 },
        { id: "059", name: "Hancock", pop: 79840 },
        { id: "061", name: "Harrison", pop: 39654 },
        { id: "063", name: "Hendricks", pop: 174788 },
        { id: "065", name: "Henry", pop: 48914 },
        { id: "067", name: "Howard", pop: 82544 },
        { id: "069", name: "Huntington", pop: 36662 },
        { id: "071", name: "Jackson", pop: 46428 },
        { id: "073", name: "Jasper", pop: 32918 },
        { id: "075", name: "Jay", pop: 20478 },
        { id: "077", name: "Jefferson", pop: 33147 },
        { id: "079", name: "Jennings", pop: 27613 },
        { id: "081", name: "Johnson", pop: 161765 },
        { id: "083", name: "Knox", pop: 36282 },
        { id: "085", name: "Kosciusko", pop: 80240 },
        { id: "087", name: "LaGrange", pop: 40446 },
        { id: "089", name: "Lake", pop: 498700 },
        { id: "091", name: "LaPorte", pop: 112417 },
        { id: "093", name: "Lawrence", pop: 45011 },
        { id: "095", name: "Madison", pop: 130129 },
        { id: "097", name: "Marion", pop: 977203 },
        { id: "099", name: "Marshall", pop: 46095 },
        { id: "101", name: "Martin", pop: 9812 },
        { id: "103", name: "Miami", pop: 35962 },
        { id: "105", name: "Monroe", pop: 139718 },
        { id: "107", name: "Montgomery", pop: 37936 },
        { id: "109", name: "Morgan", pop: 71780 },
        { id: "111", name: "Newton", pop: 13830 },
        { id: "113", name: "Noble", pop: 47457 },
        { id: "115", name: "Ohio", pop: 5940 },
        { id: "117", name: "Orange", pop: 19867 },
        { id: "119", name: "Owen", pop: 21321 },
        { id: "121", name: "Parke", pop: 16156 },
        { id: "123", name: "Perry", pop: 19170 },
        { id: "125", name: "Pike", pop: 12250 },
        { id: "127", name: "Porter", pop: 173215 },
        { id: "129", name: "Posey", pop: 25222 },
        { id: "131", name: "Pulaski", pop: 12514 },
        { id: "133", name: "Putnam", pop: 36726 },
        { id: "135", name: "Randolph", pop: 24502 },
        { id: "137", name: "Ripley", pop: 28995 },
        { id: "139", name: "Rush", pop: 16752 },
        { id: "141", name: "St. Joseph", pop: 272912 },
        { id: "143", name: "Scott", pop: 24384 },
        { id: "145", name: "Shelby", pop: 45055 },
        { id: "147", name: "Spencer", pop: 19810 },
        { id: "149", name: "Starke", pop: 23371 },
        { id: "151", name: "Steuben", pop: 34435 },
        { id: "153", name: "Sullivan", pop: 20817 },
        { id: "155", name: "Switzerland", pop: 9737 },
        { id: "157", name: "Tippecanoe", pop: 186251 },
        { id: "159", name: "Tipton", pop: 15359 },
        { id: "161", name: "Union", pop: 7087 },
        { id: "163", name: "Vanderburgh", pop: 180136 },
        { id: "165", name: "Vermillion", pop: 15439 },
        { id: "167", name: "Vigo", pop: 106153 },
        { id: "169", name: "Wabash", pop: 30976 },
        { id: "171", name: "Warren", pop: 8440 },
        { id: "173", name: "Warrick", pop: 63898 },
        { id: "175", name: "Washington", pop: 28182 },
        { id: "177", name: "Wayne", pop: 66553 },
        { id: "179", name: "Wells", pop: 28180 },
        { id: "181", name: "White", pop: 24688 },
        { id: "183", name: "Whitley", pop: 34191 }
    ];

    let currentPop = 385410; // Default Allen

    // Declare els globally (for this module) so init can populate it
    let els = {};

    function initCounties()
    {
        if (!els.inCounty) return;
        // 1. Populate Native Select (Hidden)
        els.inCounty.innerHTML = ''; // Clear
        countyData.forEach(c =>
        {
            const opt = document.createElement('option');
            opt.value = c.pop;
            opt.textContent = `${c.name} (${c.pop.toLocaleString()})`;
            if (c.name === 'Allen') opt.selected = true;
            els.inCounty.appendChild(opt);
        });

        // 2. Init Custom UI
        renderCustomOptions(countyData); // Initial Render
    }

    function renderCustomOptions(data)
    {
        const container = document.getElementById('county-options');
        if (!container) return;
        container.innerHTML = '';

        if (data.length === 0)
        {
            container.innerHTML = `<div class="p-4 text-center text-sm text-slate-400">No counties found.</div>`;
            return;
        }

        data.forEach(c =>
        {
            const div = document.createElement('div');
            div.className = "px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors flex items-center justify-between group";
            div.innerHTML = `
                <span class="font-medium">${c.name}</span>
                <span class="text-xs text-white font-mono bg-[#0f172a] dark:bg-[#0f172a] px-2 py-0.5 rounded transition-colors">${c.pop.toLocaleString()}</span>
            `;
            div.onclick = () =>
            {
                selectCounty(c.name, c.pop);
            };
            container.appendChild(div);
        });
    }

    function selectCounty(name, pop)
    {
        if (!els.inCounty) return;
        // 1. Update Native Select
        els.inCounty.value = pop;

        // 2. Update Display
        const disp = document.getElementById('county-display');
        if (disp) disp.textContent = `${name} (${pop.toLocaleString()})`;

        // 3. Trigger Calculation
        els.inCounty.dispatchEvent(new Event('change'));

        // 4. Close Menu
        toggleMenu(false);
    }

    let isOpen = false;

    function toggleMenu(show)
    {
        const menu = document.getElementById('county-menu');
        const searchInput = document.getElementById('county-search');
        if (!menu || !searchInput) return;

        isOpen = show;
        if (show)
        {
            menu.classList.remove('hidden');
            requestAnimationFrame(() =>
            {
                menu.classList.remove('opacity-0', 'scale-95');
                menu.classList.add('opacity-100', 'scale-100');
                searchInput.focus();
            });
        } else
        {
            menu.classList.remove('opacity-100', 'scale-100');
            menu.classList.add('opacity-0', 'scale-95');
            setTimeout(() =>
            {
                menu.classList.add('hidden');
                searchInput.value = ''; // Reset search
                renderCustomOptions(countyData); // Reset list
            }, 200);
        }
    }

    function calculateTax(agr)
    {
        let supplementalTax = agr * 0.035;
        let baseRate = (agr < 75000000) ? 0.05 : 0.15;
        let taxableAGR = Math.max(0, agr - 7000000);
        let freePlayDeduction = (agr > 7000000) ? 7000000 : agr;

        let bracketTax = 0;
        let breakdown = [];

        const fmtM = (v) => '$' + (v / 1000000).toFixed(1) + 'MM';
        const fmt = (v) => '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 });

        breakdown.push({ label: "Adjusted Gross Revenue (AGR)", val: fmt(agr), note: "", type: 'header' });
        breakdown.push({ label: "Supplemental Tax (3.5%)", val: fmt(supplementalTax), note: "Off the top", type: 'add' });
        breakdown.push({ label: "Free Play Deduction", val: fmt(freePlayDeduction), note: "First $7MM Exempt", type: 'info' });
        breakdown.push({ label: "Taxable AGR", val: fmt(taxableAGR), note: "AGR - $7MM", type: 'sub-header' });

        let remaining = taxableAGR;

        // Tier 1: First $25M
        let tier1Amt = Math.min(Math.max(0, remaining), 25000000);
        let t1Tax = tier1Amt * baseRate;
        bracketTax += t1Tax;
        remaining -= tier1Amt;
        breakdown.push({ label: `Tier 1 ($0-$25MM) @ ${(baseRate * 100).toFixed(0)}%`, val: fmt(t1Tax), note: `on ${fmtM(tier1Amt)}`, type: 'add' });

        // Tier 2: Next $25M ($25M-$50M) @ 20%
        let tier2Amt = Math.min(Math.max(0, remaining), 25000000);
        let t2Tax = tier2Amt * 0.20;
        bracketTax += t2Tax;
        remaining -= tier2Amt;
        breakdown.push({ label: "Tier 2 ($25MM-$50MM) @ 20%", val: fmt(t2Tax), note: `on ${fmtM(tier2Amt)}`, type: 'add' });

        // Tier 3: Next $25M ($50M-$75M) @ 25%
        let tier3Amt = Math.min(Math.max(0, remaining), 25000000);
        let t3Tax = tier3Amt * 0.25;
        bracketTax += t3Tax;
        remaining -= tier3Amt;
        breakdown.push({ label: "Tier 3 ($50MM-$75MM) @ 25%", val: fmt(t3Tax), note: `on ${fmtM(tier3Amt)}`, type: 'add' });

        // Tier 4: Next $75M ($75M-$150M) @ 30%
        let tier4Amt = Math.min(Math.max(0, remaining), 75000000);
        let t4Tax = tier4Amt * 0.30;
        bracketTax += t4Tax;
        remaining -= tier4Amt;
        breakdown.push({ label: "Tier 4 ($75MM-$150MM) @ 30%", val: fmt(t4Tax), note: `on ${fmtM(tier4Amt)}`, type: 'add' });

        // Tier 5: Next $450M ($150M-$600M) @ 35%
        let tier5Amt = Math.min(Math.max(0, remaining), 450000000);
        let t5Tax = tier5Amt * 0.35;
        bracketTax += t5Tax;
        remaining -= tier5Amt;
        breakdown.push({ label: "Tier 5 ($150MM-$600MM) @ 35%", val: fmt(t5Tax), note: `on ${fmtM(tier5Amt)}`, type: 'add' });

        // Tier 6: Over $600M @ 40%
        let t6Tax = Math.max(0, remaining) * 0.40;
        bracketTax += t6Tax;
        breakdown.push({ label: "Tier 6 (Over $600MM) @ 40%", val: fmt(t6Tax), note: `on ${fmtM(Math.max(0, remaining))}`, type: 'add' });

        let totalTax = supplementalTax + bracketTax;
        breakdown.push({ label: "TOTAL ESTIMATED TAX", val: fmt(totalTax), note: "", type: 'total' });

        const effRate = agr > 0 ? (totalTax / agr) * 100 : 0;
        breakdown.push({ label: "Effective Tax Rate of AGR", val: effRate.toFixed(2) + '%', note: "", type: 'eff-rate' });

        return { total: totalTax, breakdown: breakdown };
    }

    function calculateAGRFromTax(targetTax)
    {
        let low = 0;
        let high = 2000000000; // 2B
        let mid = 0;
        let iterations = 0;

        while (low <= high && iterations < 100)
        {
            mid = (low + high) / 2;
            const res = calculateTax(mid);
            const tax = res.total;

            if (Math.abs(tax - targetTax) < 100)
            {
                return mid;
            }

            if (tax < targetTax)
            {
                low = mid;
            } else
            {
                high = mid;
            }
            iterations++;
        }
        return mid;
    }

    function calculate(e)
    {
        if (!els.inCounty) return;

        const selectedOption = els.inCounty.options[els.inCounty.selectedIndex];
        const countyName = selectedOption ? selectedOption.text.split(' (')[0] : "Selected";
        if (els.deficitTitle) els.deficitTitle.innerHTML = `<span class="material-symbols-outlined text-red-500 align-middle mr-2">calculate</span> ${countyName} County Casino Net Economic Impact Analysis`;

        const source = e ? e.target : null;
        let revenueM = 0;
        let agrM = 0;
        let taxResult = null;

        if (source === els.inAGR)
        {
            agrM = parseFloat(els.inAGR.value);
            taxResult = calculateTax(agrM * 1000000);
            revenueM = taxResult.total / 1000000;

            if (els.inRevenue)
            {
                els.inRevenue.value = revenueM.toFixed(2);
                els.inRevenue.dispatchEvent(new Event('slider-update'));
            }
        } else if (source === els.inRevenue)
        {
            revenueM = parseFloat(els.inRevenue.value);
            const targetTax = revenueM * 1000000;
            const agr = calculateAGRFromTax(targetTax);
            agrM = agr / 1000000;
            taxResult = calculateTax(agr);

            if (els.inAGR)
            {
                els.inAGR.value = agrM.toFixed(1);
                els.inAGR.dispatchEvent(new Event('slider-update'));
            }
        } else
        {
            if (els.inRevenue)
            {
                revenueM = parseFloat(els.inRevenue.value);
                const targetTax = revenueM * 1000000;
                const agr = calculateAGRFromTax(targetTax);
                agrM = agr / 1000000;
                taxResult = calculateTax(agr);
                if (!source && els.inAGR)
                {
                    els.inAGR.value = agrM.toFixed(1);
                    els.inAGR.dispatchEvent(new Event('slider-update'));
                }
            }
        }

        if (els.valRevenue) els.valRevenue.textContent = '$' + revenueM.toFixed(1) + 'MM';
        if (els.valAGR) els.valAGR.textContent = '$' + agrM.toFixed(1) + 'MM';

        // RENDER TAX BREAKDOWN
        const container = document.getElementById('tax-details-container');
        if (container && taxResult && taxResult.breakdown)
        {
            container.classList.remove('font-mono');
            container.classList.add('font-sans');

            container.innerHTML = taxResult.breakdown.map(item =>
            {
                let colorClass = 'text-slate-400';
                if (item.type === 'total') colorClass = 'text-emerald-400 font-bold border-t border-slate-600 pt-2 mt-2';
                if (item.type === 'eff-rate') colorClass = 'text-emerald-600 dark:text-emerald-500 font-bold text-sm border-t border-slate-700/50 pt-1 mt-1';
                if (item.type === 'add') colorClass = 'text-emerald-500/80 pl-2';
                if (item.type === 'header') colorClass = 'text-white font-bold pb-1 border-b border-slate-700 mb-1';
                if (item.type === 'sub-header') colorClass = 'text-slate-200 font-semibold mt-2';
                if (item.type === 'info') colorClass = 'text-slate-500 italic pl-2';

                return `
                        <div class="flex justify-between items-center ${colorClass}">
                            <div class="flex flex-col">
                                <span>${item.label}</span>
                                ${item.note ? `<span class="text-[10px] opacity-70 font-mono">${item.note}</span>` : ''}
                            </div>
                            <span class="font-mono">${item.val}</span>
                        </div>
                    `;
            }).join('');
        }

        const inputs = [
            els.inRate, els.inAGR, els.inRevenue, els.inCostCrime, els.inCostBusiness,
            els.inCostBankruptcy, els.inCostIllness, els.inCostServices, els.inCostAbused
        ];

        inputs.forEach(input =>
        {
            if (!input) return;

            const defs = input.id === 'input-rate' ? [2.3, 3.0, 5.5] : [parseFloat(input.dataset.default)];
            let val = parseFloat(input.value);
            const min = parseFloat(input.min);
            const max = parseFloat(input.max);
            const range = max - min;
            const threshold = range * 0.015;

            let snapped = false;
            let snapVal = null;

            for (const d of defs)
            {
                if (Math.abs(val - d) < threshold)
                {
                    snapped = true;
                    snapVal = d;
                    break;
                }
            }

            const valDisplayId = input.id.replace('input-', 'val-');
            const valDisplay = document.getElementById(valDisplayId);

            let activeColor = null;
            if (input.id === 'input-rate') activeColor = 'text-orange-500';
            else if (input.id === 'input-revenue') activeColor = 'text-emerald-500';
            else if (input.id === 'input-agr') activeColor = 'text-emerald-400';

            if (snapped) 
            {
                if (Math.abs(val - snapVal) > 0.001)
                {
                    input.value = snapVal;
                    val = snapVal;
                }

                if (valDisplay && activeColor)
                {
                    valDisplay.classList.remove('text-white');
                    valDisplay.classList.add(activeColor);
                }
            } else
            {
                if (valDisplay && activeColor)
                {
                    valDisplay.classList.remove(activeColor);
                    valDisplay.classList.add('text-white');
                }
            }

            if (input.id === 'input-rate')
            {
                const radios = document.querySelectorAll('input[name="gambling-rate-preset"]');
                radios.forEach(r => r.checked = (snapped && parseFloat(r.value) === snapVal));
            } else
            {
                const sibling = input.nextElementSibling;
                if (sibling && sibling.type === 'radio')
                {
                    sibling.checked = snapped;
                }
            }
        });

        // NOTE: revenueM is already calculated above
        const rate = parseFloat(els.inRate.value);

        // Get costs
        const cCrime = parseInt(els.inCostCrime.value);
        const cBusiness = parseInt(els.inCostBusiness.value);
        const cBankruptcy = parseInt(els.inCostBankruptcy.value);
        const cIllness = parseInt(els.inCostIllness.value);
        const cServices = parseInt(els.inCostServices.value);
        const cAbused = parseInt(els.inCostAbused.value);

        const costPer = cCrime + cBusiness + cBankruptcy + cIllness + cServices + cAbused;

        if (els.valRate) els.valRate.textContent = rate.toFixed(1) + '%';
        if (els.valCostTotal) els.valCostTotal.textContent = '$' + costPer.toLocaleString();
        if (els.valCostCrime) els.valCostCrime.textContent = '$' + cCrime.toLocaleString();
        if (els.valCostBusiness) els.valCostBusiness.textContent = '$' + cBusiness.toLocaleString();
        if (els.valCostBankruptcy) els.valCostBankruptcy.textContent = '$' + cBankruptcy.toLocaleString();
        if (els.valCostIllness) els.valCostIllness.textContent = '$' + cIllness.toLocaleString();
        if (els.valCostServices) els.valCostServices.textContent = '$' + cServices.toLocaleString();
        if (els.valCostAbused) els.valCostAbused.textContent = '$' + cAbused.toLocaleString();

        let victims = 0;
        const tvEl = document.getElementById('total-gamblers');
        if (tvEl)
        {
            victims = parseInt(tvEl.textContent.replace(/,/g, '')) || 0;
        }

        // ... Continued logic for final result display ...
        // For brevity in this extraction, ensuring the update updates:
        const totalCost = victims * costPer;
        const netDeficit = (revenueM * 1000000) - totalCost;

        if (els.resTotalCost) els.resTotalCost.textContent = '$' + totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (els.resEqRevenue) els.resEqRevenue.textContent = '$' + (revenueM * 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (els.resEqCost) els.resEqCost.textContent = '-$' + totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 });

        if (els.resDeficit)
        {
            els.resDeficit.textContent = (netDeficit >= 0 ? '+' : '-') + '$' + Math.abs(netDeficit).toLocaleString(undefined, { maximumFractionDigits: 0 });
            if (netDeficit >= 0)
            {
                els.resDeficit.classList.remove('text-red-500');
                els.resDeficit.classList.add('text-green-500');
                if (els.resResultLabel) els.resResultLabel.textContent = "NET GAIN";
            } else
            {
                els.resDeficit.classList.remove('text-green-500');
                els.resDeficit.classList.add('text-red-500');
                if (els.resResultLabel) els.resResultLabel.textContent = "NET LOSS";
            }
        }
    }

    function init()
    {
        els = {
            inCounty: document.getElementById('input-county'),
            inRevenue: document.getElementById('input-revenue'),
            inAGR: document.getElementById('input-agr'),
            inRate: document.getElementById('input-rate'),
            inAllocation: document.getElementById('input-allocation'),

            inCostCrime: document.getElementById('input-cost-crime'),
            inCostBusiness: document.getElementById('input-cost-business'),
            inCostBankruptcy: document.getElementById('input-cost-bankruptcy'),
            inCostIllness: document.getElementById('input-cost-illness'),
            inCostServices: document.getElementById('input-cost-services'),
            inCostAbused: document.getElementById('input-cost-abused'),

            valRevenue: document.getElementById('val-revenue'),
            valAGR: document.getElementById('val-agr'),
            valRate: document.getElementById('val-rate'),
            valCostTotal: document.getElementById('val-cost-total'),
            valCostCrime: document.getElementById('val-cost-crime'),
            valCostBusiness: document.getElementById('val-cost-business'),
            valCostBankruptcy: document.getElementById('val-cost-bankruptcy'),
            valCostIllness: document.getElementById('val-cost-illness'),
            valCostServices: document.getElementById('val-cost-services'),
            valCostAbused: document.getElementById('val-cost-abused'),

            resTotalCost: document.getElementById('res-total-cost'),
            resDeficit: document.getElementById('res-deficit'),
            resResultLabel: document.getElementById('res-result-label'),
            resEqRevenue: document.getElementById('res-eq-revenue'),
            resEqCost: document.getElementById('res-eq-cost'),

            deficitTitle: document.getElementById('deficit-title')
        };

        const sliderConfigs = [
            { id: 'input-rate', stepMajor: 1.0, stepMinor: 0.5, format: v => v + '%' },
            { id: 'input-agr', stepMajor: 100, stepMinor: 25, format: v => '$' + v + 'MM' },
            { id: 'input-revenue', stepMajor: 50, stepMinor: 10, format: v => '$' + v + 'MM' },
            { id: 'input-cost-crime', stepMajor: 2000, stepMinor: 500, format: v => '$' + parseInt(v).toLocaleString() },
            { id: 'input-cost-business', stepMajor: 2000, stepMinor: 500, format: v => '$' + parseInt(v).toLocaleString() },
            { id: 'input-cost-bankruptcy', stepMajor: 2000, stepMinor: 500, format: v => '$' + parseInt(v).toLocaleString() },
            { id: 'input-cost-illness', stepMajor: 2000, stepMinor: 500, format: v => '$' + parseInt(v).toLocaleString() },
            { id: 'input-cost-services', stepMajor: 2000, stepMinor: 500, format: v => '$' + parseInt(v).toLocaleString() },
            { id: 'input-cost-abused', stepMajor: 2000, stepMinor: 500, format: v => '$' + parseInt(v).toLocaleString() }
        ];

        sliderConfigs.forEach(cfg =>
        {
            const input = document.getElementById(cfg.id);
            if (!input) return;

            const container = input.parentElement;

            const children = Array.from(container.children);
            children.forEach(child =>
            {
                if (child.className.includes('slider-tick') || child.className.includes('tick-label') || child.className.includes('slider-tooltip') || child.className.includes('slider-track'))
                {
                    child.remove();
                }
            });

            // Bind Radio Buttons
            const radios = container.querySelectorAll('input[type="radio"]');
            radios.forEach(radio =>
            {
                radio.addEventListener('change', () =>
                {
                    input.value = radio.value;
                    input.dispatchEvent(new Event('input'));
                    input.dispatchEvent(new Event('change'));
                });

                input.addEventListener('input', () =>
                {
                    if (Math.abs(parseFloat(input.value) - parseFloat(radio.value)) < 0.1)
                    {
                        radio.checked = true;
                    } else
                    {
                        radio.checked = false;
                    }
                });
            });

            input.classList.remove('bg-slate-700');
            input.classList.add('bg-transparent');
            input.style.backgroundColor = 'transparent';

            const track = document.createElement('div');
            track.className = 'slider-track';
            container.insertBefore(track, input);

            const min = parseFloat(input.min);
            const max = parseFloat(input.max);
            const range = max - min;

            function addTick(val, typeClass, labelText = null)
            {
                const tick = document.createElement('div');
                tick.className = `slider-tick ${typeClass}`;
                const pct = ((val - min) / range) * 100;
                tick.style.left = `${pct}%`;
                container.insertBefore(tick, input);

                if (labelText)
                {
                    const label = document.createElement('div');
                    label.className = 'tick-label';
                    label.textContent = labelText;
                    label.style.left = `${pct}%`;
                    container.insertBefore(label, input);
                }
            }

            if (range > 0)
            {
                const startMajor = Math.ceil(min / cfg.stepMajor) * cfg.stepMajor;
                for (let v = startMajor; v <= max; v += cfg.stepMajor)
                {
                    addTick(v, 'tick-major', cfg.format(v));
                }

                const startMinor = Math.ceil(min / cfg.stepMinor) * cfg.stepMinor;
                for (let v = startMinor; v <= max; v += cfg.stepMinor)
                {
                    if (v % cfg.stepMajor !== 0)
                    {
                        addTick(v, 'tick-minor');
                    }
                }
            }

            // Listeners
            input.addEventListener('input', (e) => calculate(e));
        });

        initCounties();

        // Menu Listeners
        const trigger = document.getElementById('county-trigger');
        const menu = document.getElementById('county-menu');
        const searchInput = document.getElementById('county-search');

        if (trigger)
        {
            trigger.onclick = (e) =>
            {
                e.preventDefault();
                toggleMenu(!isOpen);
            };
        }

        if (searchInput)
        {
            searchInput.oninput = (e) =>
            {
                const term = e.target.value.toLowerCase();
                const filtered = countyData.filter(c => c.name.toLowerCase().includes(term));
                renderCustomOptions(filtered);
            };
        }

        document.addEventListener('click', (e) =>
        {
            if (trigger && menu && !trigger.contains(e.target) && !menu.contains(e.target) && isOpen)
            {
                toggleMenu(false);
            }
        });

        // Initial Calculation
        calculate();
    }

    return { init: init };
})();

/* --- Simulator Modal Extensions --- */
window.currentSimStep = 1;

window.openSimulatorModal = function ()
{
    const modal = document.getElementById('simulator-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    // Force reflow
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    window.currentSimStep = 1;
    window.updateSimStep();
};

window.closeSimulatorModal = function ()
{
    const modal = document.getElementById('simulator-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    setTimeout(() =>
    {
        modal.classList.add('hidden');
    }, 300);
};

window.goToSimStep = function (step)
{
    window.currentSimStep = step;
    window.updateSimStep();
};

window.nextSimStep = function ()
{
    if (window.currentSimStep < 3)
    {
        window.currentSimStep++;
        window.updateSimStep();
    }
};

window.prevSimStep = function ()
{
    if (window.currentSimStep > 1)
    {
        window.currentSimStep--;
        window.updateSimStep();
    }
};

window.updateSimStep = function ()
{
    // Content Visibility
    for (let i = 1; i <= 3; i++)
    {
        const el = document.getElementById(`sim-step-${i}`);
        if (el)
        {
            if (i === window.currentSimStep) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    }

    // Buttons
    const btnBack = document.getElementById('sim-btn-back');
    const btnCancel = document.getElementById('sim-btn-cancel');
    const btnNext = document.getElementById('sim-btn-next');
    const btnRun = document.getElementById('sim-btn-run');

    if (window.currentSimStep === 1)
    {
        if (btnBack) btnBack.classList.add('hidden');
        if (btnCancel) btnCancel.classList.remove('hidden');
        if (btnNext) btnNext.classList.remove('hidden');
        if (btnRun) btnRun.classList.add('hidden');
    } else if (window.currentSimStep === 2)
    {
        if (btnBack) btnBack.classList.remove('hidden');
        if (btnCancel) btnCancel.classList.add('hidden');
        if (btnNext) btnNext.classList.remove('hidden');
        if (btnRun) btnRun.classList.add('hidden');
    } else
    {
        if (btnBack) btnBack.classList.remove('hidden');
        if (btnCancel) btnCancel.classList.add('hidden');
        if (btnNext) btnNext.classList.add('hidden');
        if (btnRun) btnRun.classList.remove('hidden');
    }

    // Progress Bar (Segmented)
    const colors = {
        1: { bar: 'bg-emerald-500', shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]', text: 'text-emerald-400' },
        2: { bar: 'bg-purple-500', shadow: 'shadow-[0_0_10px_rgba(168,85,247,0.5)]', text: 'text-purple-400' },
        3: { bar: 'bg-red-500', shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]', text: 'text-red-400' }
    };

    for (let i = 1; i <= 3; i++)
    {
        const bar = document.getElementById(`sim-bar-${i}`);
        const label = document.getElementById(`sim-label-${i}`);
        if (!bar || !label) continue;

        const config = colors[i];

        // Reset classes
        bar.classList.remove('bg-slate-700', 'bg-blue-500', 'bg-purple-500', 'bg-red-500',
            'shadow-[0_0_10px_rgba(59,130,246,0.5)]',
            'shadow-[0_0_10px_rgba(168,85,247,0.5)]',
            'shadow-[0_0_10px_rgba(239,68,68,0.5)]');
        label.classList.remove('text-slate-600', 'text-blue-400', 'text-purple-400', 'text-red-400');

        if (i <= window.currentSimStep)
        {
            bar.classList.add(config.bar, config.shadow);
            label.classList.add(config.text);
        } else
        {
            bar.classList.add('bg-slate-700');
            label.classList.add('text-slate-600');
        }
    }
};

window.updateCustomCostDisplay = function ()
{
    const dirInput = document.querySelector('input[name="sim-cost-dir"]:checked');
    const pctInput = document.getElementById('sim-custom-pct');
    if (!dirInput || !pctInput) return;

    const dir = parseInt(dirInput.value);
    const pct = parseFloat(pctInput.value) || 0;
    const mult = 1 + (dir * (pct / 100));
    const resEl = document.getElementById('sim-custom-result');
    if (resEl) resEl.textContent = mult.toFixed(2) + 'x';
};

window.runSimulation = function ()
{
    // 1. Get Values
    let agrInputEl = document.querySelector('input[name="sim-agr"]:checked');
    let agrVal = agrInputEl ? agrInputEl.value : '112';
    if (agrVal === 'custom')
    {
        agrVal = document.getElementById('sim-custom-agr').value || 112;
    }

    let allocInputEl = document.querySelector('input[name="sim-alloc"]:checked');
    let allocVal = allocInputEl ? allocInputEl.value : '40';
    if (allocVal === 'custom')
    {
        allocVal = document.getElementById('sim-custom-alloc').value || 40;
    }

    let costInputEl = document.querySelector('input[name="sim-cost"]:checked');
    let costMult = costInputEl ? costInputEl.value : '1.0';
    if (costMult === 'custom')
    {
        const dirInput = document.querySelector('input[name="sim-cost-dir"]:checked');
        const dir = dirInput ? parseInt(dirInput.value) : 1;
        const pct = parseFloat(document.getElementById('sim-custom-pct').value) || 0;
        costMult = 1 + (dir * (pct / 100));
    } else
    {
        costMult = parseFloat(costMult);
    }

    // 2. Update Main Inputs
    const mainAgrInput = document.getElementById('input-agr');
    const mainAllocInput = document.getElementById('input-allocation');

    if (mainAgrInput)
    {
        mainAgrInput.value = agrVal;
        mainAgrInput.dispatchEvent(new Event('input'));
        mainAgrInput.dispatchEvent(new Event('change'));
    }

    if (mainAllocInput)
    {
        mainAllocInput.value = allocVal;
        mainAllocInput.dispatchEvent(new Event('input'));
    }

    // 3. Social Cost Multipliers
    const costInputs = [
        'input-cost-crime', 'input-cost-business', 'input-cost-bankruptcy',
        'input-cost-illness', 'input-cost-services', 'input-cost-abused'
    ];

    costInputs.forEach(id =>
    {
        const input = document.getElementById(id);
        if (input)
        {
            const base = parseFloat(input.dataset.default) || 0;
            const newVal = Math.round(base * costMult);
            input.value = newVal;
            input.dispatchEvent(new Event('input'));
        }
    });

    // Close Modal
    window.closeSimulatorModal();

    // Scroll to results or calculator
    const calculator = document.getElementById('calculator-controls');
    if (calculator)
    {
        calculator.scrollIntoView({ behavior: 'smooth' });
    }
};

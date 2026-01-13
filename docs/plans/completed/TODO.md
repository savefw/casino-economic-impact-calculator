# TODO: Project Improvements & Fixes

## 1. Automated Analysis Refactoring (Post-CALCULATION_UPDATES.md)
The manual dashboard UI has been updated to distinguish between **Total Estimated** problem gamblers and **Net New (Attributable)** problem gamblers. The "automated analysis" (the dynamic prose generated in the dashboard) still needs to be updated to match this logic.

### Rules
Dynamically generated text in the analysis should not be bolded. Utilize the same slate color that is applied elsewhere. The only bold text for each bullet point is the beginning word(s) that precede the colon, as well as the colon being bolded.

### Context
- **Files Involved:** `SaveFW/SaveFW.Client/wwwroot/js/economics/calculator.js` (specifically the `DYNAMIC ANALYSIS TEXT` section starting around line 1086).
- **Goal:** Update the prose so it doesn't just say "new problem gamblers" when referring to the total prevalence in a zone.

### Specific Changes Needed
- [ ] **Distinguish between total and net new in prose:** 
    - The summary text should mention both the total expected prevalence (post-casino) and the subset that is directly attributable to the casino (net new).
- [ ] **Baseline Tier Clarification:** Ensure the prose for the 20–50 mile tier (Baseline Risk) explicitly states that while there are total problem gamblers in this population, the **Net New (Attributable)** count is zero.
- [ ] **Variable Synchronization:** Ensure `calculator.js` is correctly pulling the split values from the `impact-breakdown-updated` event payload (which now includes both `victims` [Net New] and `totalEstimated`).
- [ ] **Prevalence Outcome Bullet:** Update line ~1183 in `calculator.js` to distinguish between the "Total estimated problem gamblers" and the "Net new problem gamblers attributable to the casino".

## 2. Methodology PDF Update
- [ ] Review `Independent_Analysis_Allen_County_Casino.pdf` (assets) to ensure the described methodology aligns with the "Net New" marginal prevalence model. If not, a note should be added to the UI or the PDF should be updated.

## 3. UI Polish
- [ ] Monitor the 3-step map navigation overlay on various mobile devices to ensure the abbreviations (Ntl., St.) and restricted width prevent any further collision with the full-screen toggle.

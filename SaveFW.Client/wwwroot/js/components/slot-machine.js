window.SlotMachine = (function ()
{
    const ITEM_HEIGHT = 80;
    const SLOT_COUNT = 15; // Total items on the ring
    const TARGET_INDEX = 8; // Where the "Truth" lands (Rigged)
    // Radius calculation for a Polygon/Cylinder
    // r = (w / 2) / tan(PI / n)
    // w = height of item here because we rotateX
    const RADIUS = Math.round((ITEM_HEIGHT / 2) / Math.tan(Math.PI / SLOT_COUNT));

    const BAIT_WORDS = [
        "WORLD-CLASS DESTINATION", "INCREDIBLE OPPORTUNITY", "ECONOMIC ENGINE",
        "REVITALIZED INFRASTRUCTURE", "NEIGHBORHOOD IMPROVEMENTS", "HUMANITARIAN FUND",
        "RESPONSIBLE GAMING", "RETAIN TALENT", "COMMUNITY WELL-BEING", "PREMIER DESTINATION", "GOOD PAYING JOBS"
    ];
    const TARGET_WORDS = [
        "ADDICTION", "HUMAN TRAFFICKING", "EMBEZZLEMENT", "POVERTY", "CHILD NEGLECT", "DOMESTIC VIOLENCE",
        "BANKRUPTCIES", "DIVORCES", "SUBSTANCE ABUSE", "HOMELESSNESS", "FORECLOSURE", "CORRUPTION", "BAD DEBT",
        "FATAL ACCIDENTS", "LOCAL BUSINESSES LOST", "MENTAL HEALTH ISSUES", "LOW WAGE JOBS"
    ]; // The forced outcomes (Negative)

    let currentRotation = [0, 0, 0]; // Track rotation per reel
    let isAtFront = true; // State to toggle between index 0 and 8
    let isSpinning = false;
    let isSirenActive = false;
    let lightAnimationId = null;
    let sirenTimeout = null;

    // Casino Lights Generator
    function initLights()
    {
        const list = document.getElementById('casino-lights');
        const wrapper = document.querySelector('.slot-machine-wrapper');
        if (!list || !wrapper) return;

        // Stop existing animation loop to prevent duplicates/memory leaks
        if (lightAnimationId) cancelAnimationFrame(lightAnimationId);

        list.innerHTML = '';

        // Use offsetWidth/Height instead of getBoundingClientRect 
        // to ignore CSS transforms (scale) on mobile.
        const w = wrapper.offsetWidth;
        const h = wrapper.offsetHeight;

        const rx = w / 2;
        const ry = 100;
        const spacing = 35; // Pixel spacing between bulbs

        // Temporary arrays to hold bulbs before combining
        const arcBulbs = [];
        const leftBulbs = [];
        const rightBulbs = [];

        // Shift logic for right side (Move tiny bit to the left)
        const getShiftedX = (x) =>
        {
            if (x <= rx) return x;
            // Smoothly increase shift from 0 at center peak to 4px at the right edge
            const factor = (x - rx) / rx;
            return x - (factor * 4);
        };

        // Helper to create a 3D bulb element (does not append to DOM yet)
        const createBulb = (x, y, rot) =>
        {
            const li = document.createElement('li');
            li.style.left = `${getShiftedX(x)}px`;
            li.style.top = `${y}px`;
            li.style.transform = `rotate(${rot}deg)`;
            return li;
        };

        const getPoint = (t) => ({
            x: rx + rx * Math.cos(t),
            y: ry + ry * Math.sin(t)
        });

        // Calculate Total Arc Length
        let totalArcLength = 0;
        const segments = 300;
        const dt = Math.PI / segments;
        let prevP = getPoint(Math.PI);

        for (let i = 1; i <= segments; i++)
        {
            const t = Math.PI + (i * dt);
            const p = getPoint(t);
            totalArcLength += Math.sqrt(Math.pow(p.x - prevP.x, 2) + Math.pow(p.y - prevP.y, 2));
            prevP = p;
        }

        const numIntervals = Math.round(totalArcLength / spacing);
        const actualSpacing = totalArcLength / numIntervals;

        // --- 1. ARC BULBS GENERATION ---
        let currentLen = 0;
        let nextTarget = 0;

        prevP = getPoint(Math.PI); // Reset

        // Place first bulb manually (Left Corner of Arc)
        arcBulbs.push(createBulb(prevP.x, prevP.y, 270));
        nextTarget += actualSpacing;

        for (let i = 1; i <= segments; i++)
        {
            const t = Math.PI + (i * dt);
            const p = getPoint(t);
            const dist = Math.sqrt(Math.pow(p.x - prevP.x, 2) + Math.pow(p.y - prevP.y, 2));

            if (currentLen + dist >= nextTarget)
            {
                // Interpolate for precision
                const remaining = nextTarget - currentLen;
                const ratio = remaining / dist;
                const interpT = (Math.PI + ((i - 1) * dt)) + (ratio * dt);
                const finalP = getPoint(interpT);
                const deg = (interpT * 180 / Math.PI) + 90;

                arcBulbs.push(createBulb(finalP.x, finalP.y, deg));
                nextTarget += actualSpacing;
            }
            currentLen += dist;
            prevP = p;
        }

        // --- 2. SIDE LIGHTS GENERATION ---
        const sideStartY = ry;
        const sideEndY = h - 35; // Shorten (approx 1 bulb)
        const numSide = Math.max(0, Math.floor((sideEndY - sideStartY) / spacing));

        for (let i = 0; i < numSide; i++)
        {
            const y = sideStartY + ((i + 1) * spacing);
            // Left Edge (x = 0) - Bottom to Top requires reverse logic later
            leftBulbs.push(createBulb(0, y, 0));
            // Right Edge (x = w) - Top to Bottom
            rightBulbs.push(createBulb(w, y, 180));
        }

        // --- 3. COMBINE & INDEX ---
        // Sequence: Left (Bottom->Top) -> Arc (Left->Right) -> Right (Top->Bottom)
        // leftBulbs was generated Top->Bottom (y increasing), so we reverse it.
        const bulbs = [...leftBulbs.reverse(), ...arcBulbs, ...rightBulbs];

        bulbs.forEach((li, i) =>
        {
            // Store metadata for the animation loop
            li.dataset.group = i % 6;
            li.dataset.index = i;
            list.appendChild(li);
        });

        // Single Animation Loop for High Performance
        const animate = () =>
        {
            const now = Date.now();

            if (isSirenActive)
            {
                // Synchronous fast blinking (Panic Mode - RED)
                const isPhaseOn = Math.floor(now / 300) % 2 === 0;
                for (let i = 0; i < bulbs.length; i++)
                {
                    const li = bulbs[i];
                    li.classList.add('bulb-red'); // Turn RED
                    if (isPhaseOn) li.classList.remove('bulb-off');
                    else li.classList.add('bulb-off');
                }
            } else if (isSpinning)
            {
                // Sequential Chase (Running Light)
                const speed = 20; // Lower is faster
                const totalBulbs = bulbs.length;
                const activeIndex = Math.floor(now / speed) % totalBulbs;

                for (let i = 0; i < totalBulbs; i++)
                {
                    const li = bulbs[i];
                    li.classList.remove('bulb-red'); // Ensure not red
                    // Simple dot mode
                    if (i === activeIndex) li.classList.remove('bulb-off');
                    else li.classList.add('bulb-off');
                }
            } else
            {
                // Idle / Attract Mode (Original Logic)
                // Logic: 1200ms ON, 1200ms OFF => 2400ms period.
                // Stagger offset: group * 400ms.
                for (let i = 0; i < bulbs.length; i++)
                {
                    const li = bulbs[i];
                    li.classList.remove('bulb-red'); // Ensure not red
                    const group = parseInt(li.dataset.group);
                    const index = parseInt(li.dataset.index);

                    const offset = group * 400;
                    const tEff = now - offset;
                    const phase = Math.floor(tEff / 1200);

                    // Initial state logic from original: i % 2 === 0 starts OFF
                    const initialIsOff = (index % 2 === 0);
                    let isOff = initialIsOff;

                    // Flip state every 1200ms phase
                    if (phase % 2 !== 0)
                    {
                        isOff = !isOff;
                    }

                    if (isOff)
                    {
                        li.classList.add('bulb-off');
                    } else
                    {
                        li.classList.remove('bulb-off');
                    }
                }
            }

            lightAnimationId = requestAnimationFrame(animate);
        };

        // Start loop
        animate();
    }

    function initReels()
    {
        const reels = [
            document.getElementById('reel-1'),
            document.getElementById('reel-2'),
            document.getElementById('reel-3')
        ];

        const START_WORDS = ["WORLD-CLASS", "ECONOMIC ENGINE", "HUMANITARIAN FUND"];

        reels.forEach((reel, index) =>
        {
            if (!reel) return;

            // Mobile performance: hint GPU to prepare for transforms
            reel.style.willChange = 'transform';

            let content = "";

            for (let i = 0; i < SLOT_COUNT; i++)
            {
                let word;
                let className = "slot-item";

                if (i === 0)
                {
                    word = START_WORDS[index];
                } else
                {
                    if (Math.random() > 0.33)
                    {
                        word = BAIT_WORDS[Math.floor(Math.random() * BAIT_WORDS.length)];
                    } else
                    {
                        word = TARGET_WORDS[Math.floor(Math.random() * TARGET_WORDS.length)];
                        className += " truth-word";
                    }
                }

                const theta = 360 / SLOT_COUNT;
                const angle = theta * i;

                content += `<div class="${className}" style="transform: rotateX(${angle}deg) translateZ(${RADIUS}px)">` + word + `</div>`;
            }

            reel.style.transition = 'none';
            reel.innerHTML = content;
            reel.style.transform = `translateZ(-${RADIUS}px) rotateX(0deg)`;
            reel.offsetHeight;
            reel.style.transition = '';
        });
    }

    function updateSlot(reelEl, index, text, type)
    {
        const safeIndex = (index + SLOT_COUNT) % SLOT_COUNT;
        const slot = reelEl.children[safeIndex];

        slot.textContent = text;
        slot.className = 'slot-item';

        if (type === 'truth')
        {
            slot.classList.add('truth-word');
        } else if (type === 'near-miss')
        {
            slot.classList.add('near-miss');
        }
    }

    function performSpin(index, delay = 0)
    {
        const reel = document.getElementById(`reel-${index + 1}`);
        if (!reel) return;

        const theta = 360 / SLOT_COUNT;

        const targetIndex = isAtFront ? 8 : 0;
        const destAngle = -1 * targetIndex * theta;

        const negativeWord = TARGET_WORDS[Math.floor(Math.random() * TARGET_WORDS.length)];
        updateSlot(reel, targetIndex, negativeWord, 'truth');

        const shuffledBait = [...BAIT_WORDS].sort(() => 0.5 - Math.random());
        const near1 = shuffledBait[0];
        const near2 = shuffledBait[1];
        updateSlot(reel, targetIndex - 1, near1, 'near-miss');
        updateSlot(reel, targetIndex + 1, near2, 'near-miss');

        let current = currentRotation[index];
        let currentNormalized = current % 360;
        let diff = destAngle - currentNormalized;
        while (diff < 0) diff += 360;

        let spin = 360 * 5;
        let finalRotation = current + spin + diff;

        currentRotation[index] = finalRotation;

        setTimeout(() =>
        {
            reel.style.transform = `translateZ(-${RADIUS}px) rotateX(${finalRotation}deg)`;
        }, delay);
    }

    function spinReel(index)
    {
        if (isSpinning) return;
        performSpin(index, 0);
    }

    function resetSiren()
    {
        isSirenActive = false;
        const siren = document.getElementById('siren');
        if (siren) siren.classList.remove('siren-active');
        if (sirenTimeout) clearTimeout(sirenTimeout);
    }

    function spinTheTruth()
    {
        if (isSpinning) return;
        isSpinning = true;

        resetSiren();

        isAtFront = !isAtFront;
        const targetIndex = isAtFront ? 8 : 0;

        [0, 1, 2].forEach(index =>
        {
            performSpin(index, index * 200);
        });

        setTimeout(() =>
        {
            isSpinning = false;

            const siren = document.getElementById('siren');
            if (siren)
            {
                siren.classList.add('siren-active');
                isSirenActive = true;

                sirenTimeout = setTimeout(() =>
                {
                    siren.classList.remove('siren-active');
                    isSirenActive = false;
                }, 5000);
            }
        }, 6500);
    }

    function initLever()
    {
        const lever = document.getElementById('slot-lever');
        const knob = document.querySelector('.lever-knob');

        if (!lever || !knob) return;

        let isDragging = false;
        let startY = 0;

        function startDrag(e)
        {
            if (isSpinning) return;
            if (e.cancelable) e.preventDefault();

            isDragging = true;
            startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
            lever.style.transition = 'none';
            knob.style.transition = 'none';

            // Mobile performance: hint GPU
            lever.style.willChange = 'transform';
            knob.style.willChange = 'transform';
        }

        function moveDrag(e)
        {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();

            const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
            const diff = currentY - startY;

            let deg = Math.min(70, Math.max(0, diff / 2.5));

            lever.style.transform = `rotateX(-${deg}deg)`;
            knob.style.transform = `translateX(-50%) translateZ(10px) rotateX(${deg}deg)`;
        }

        function endDrag(e)
        {
            if (!isDragging) return;
            isDragging = false;

            const transform = lever.style.transform;
            const match = transform.match(/rotateX\(([-\d.]+)deg\)/);
            const currentDeg = match ? parseFloat(match[1]) : 0;

            lever.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            knob.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

            lever.style.transform = `rotateX(0deg)`;
            knob.style.transform = `translateX(-50%) translateZ(10px) rotateX(0deg)`;

            // Remove will-change after transition completes
            setTimeout(() =>
            {
                lever.style.willChange = 'auto';
                knob.style.willChange = 'auto';
            }, 450);

            if (Math.abs(currentDeg) > 45)
            {
                spinTheTruth();
            } else
            {
                if (Math.abs(currentDeg) < 5 && e.type !== 'touchend')
                {
                    animateLeverPull();
                }
            }
        }

        function animateLeverPull()
        {
            if (isSpinning) return;

            lever.classList.add('lever-pulled');
            spinTheTruth();

            setTimeout(() =>
            {
                lever.classList.remove('lever-pulled');
            }, 600);
        }

        lever.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('mouseup', endDrag);

        lever.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', moveDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    function init()
    {
        initReels();
        initLights();
        initLever();

        const wrapper = document.querySelector('.slot-machine-wrapper');
        if (wrapper)
        {
            const ro = new ResizeObserver(entries =>
            {
                // Debounce re-layout
                clearTimeout(window._slotResizeTimer);
                window._slotResizeTimer = setTimeout(initLights, 50);
            });
            ro.observe(wrapper);
        }

        // Expose spinReel globally if needed by buttons outside
        window.spinReel = spinReel;
    }

    return {
        init: init
    };
})();

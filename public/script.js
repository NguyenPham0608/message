document.addEventListener('DOMContentLoaded', () => {

    /* ══════════════════════════════════════════════════════════
       PHYSICS-BASED LIQUID GLASS
       Generates a displacement map using Snell's Law refraction
       over a squircle-shaped convex surface, then applies it via
       SVG feDisplacementMap to a cloned background image.
       ══════════════════════════════════════════════════════════ */

    const svgDefs = document.getElementById('svgDefs');
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const positionUpdaters = [];
    let filterIdCounter = 0;

    // Cache: reuse the same filter for identically-sized panels
    const filterCache = {};  // "WxH" → { filterId, dataUrl, scale }

    /* ── Squircle height profile (Apple's 4th-root curve) ───── */

    function squircleHeight(t) {
        // t: 0 = at edge, 1 = deep interior
        // Returns 0..1 surface height
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        const clamped = Math.min(Math.max(t, 0), 1);
        return Math.pow(1 - Math.pow(1 - clamped, 4), 0.25);
    }

    /* ── Numerical derivative of height profile ─────────────── */

    function squircleSlope(t) {
        const eps = 0.001;
        return (squircleHeight(t + eps) - squircleHeight(t - eps)) / (2 * eps);
    }

    /* ── Rounded-rect SDF (signed distance field) ───────────── */

    function roundedRectSDF(px, py, cx, cy, halfW, halfH, cornerR) {
        const qx = Math.abs(px - cx) - halfW + cornerR;
        const qy = Math.abs(py - cy) - halfH + cornerR;
        const outsideDist = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - cornerR;
        const insideDist = Math.min(Math.max(qx, qy), 0);
        return outsideDist + insideDist; // negative inside
    }

    /* ── SDF gradient (gives direction perpendicular to edge) ── */

    function sdfGradient(px, py, cx, cy, halfW, halfH, cornerR) {
        const eps = 0.5;
        const dx = roundedRectSDF(px + eps, py, cx, cy, halfW, halfH, cornerR)
                  - roundedRectSDF(px - eps, py, cx, cy, halfW, halfH, cornerR);
        const dy = roundedRectSDF(px, py + eps, cx, cy, halfW, halfH, cornerR)
                  - roundedRectSDF(px, py - eps, cx, cy, halfW, halfH, cornerR);
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: dx / len, y: dy / len };
    }

    /* ── Generate physics-based displacement map ───────────── */

    function generateDisplacementMap(w, h, cornerRadius) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;

        const cx = w / 2;
        const cy = h / 2;
        const halfW = w / 2;
        const halfH = h / 2;
        const cR = Math.min(cornerRadius, halfW, halfH);

        // How deep into the shape the "bezel" (curved edge) extends
        const bezelWidth = Math.min(halfW, halfH) * 0.5;

        // Virtual glass thickness — controls refraction strength
        const glassThickness = 50;

        // Refractive index of glass
        const n = 1.5;

        // First pass: compute raw displacement magnitudes to find the max
        const displacements = new Float32Array(w * h * 2); // [dx, dy] pairs
        let maxMag = 0;

        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                const idx = (py * w + px) * 2;

                const sdf = roundedRectSDF(px, py, cx, cy, halfW, halfH, cR);

                if (sdf >= 0) {
                    // Outside shape — no displacement
                    displacements[idx] = 0;
                    displacements[idx + 1] = 0;
                    continue;
                }

                // Distance from edge (positive inside)
                const edgeDist = -sdf;

                // Normalize to bezel region: 0 = at edge, 1 = past bezel into flat interior
                const t = Math.min(edgeDist / bezelWidth, 1);

                if (t >= 1) {
                    // Flat interior — no refraction
                    displacements[idx] = 0;
                    displacements[idx + 1] = 0;
                    continue;
                }

                // Surface slope from squircle profile
                const slope = squircleSlope(t);

                // Incident angle (from surface slope)
                const thetaIncident = Math.atan(slope);

                // Snell's Law: sin(θ_refracted) = sin(θ_incident) / n
                const sinRefracted = Math.sin(thetaIncident) / n;

                // Total internal reflection check (shouldn't happen with n=1.5 but safety)
                if (Math.abs(sinRefracted) >= 1) {
                    displacements[idx] = 0;
                    displacements[idx + 1] = 0;
                    continue;
                }

                const thetaRefracted = Math.asin(sinRefracted);

                // Displacement magnitude: how far the refracted ray shifts
                // at the background plane, relative to the unrefracted ray
                const dispMag = Math.tan(thetaIncident - thetaRefracted) * glassThickness;

                // Direction: perpendicular to the nearest edge, pointing inward
                // The SDF gradient points outward from the shape, so negate it
                const grad = sdfGradient(px, py, cx, cy, halfW, halfH, cR);
                const dirX = -grad.x;
                const dirY = -grad.y;

                const dx = dirX * dispMag;
                const dy = dirY * dispMag;

                displacements[idx] = dx;
                displacements[idx + 1] = dy;

                const mag = Math.sqrt(dx * dx + dy * dy);
                if (mag > maxMag) maxMag = mag;
            }
        }

        // Ensure maxMag is at least 1 to avoid division by zero
        if (maxMag < 0.001) maxMag = 1;

        // Second pass: normalize and encode as RGBA
        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                const srcIdx = (py * w + px) * 2;
                const dstIdx = (py * w + px) * 4;

                const dx = displacements[srcIdx];
                const dy = displacements[srcIdx + 1];

                // Normalize to [-1, 1] range, then encode as [0, 255]
                // 128 = no displacement
                data[dstIdx]     = Math.round(128 + (dx / maxMag) * 127); // R → X
                data[dstIdx + 1] = Math.round(128 + (dy / maxMag) * 127); // G → Y
                data[dstIdx + 2] = 128; // B — unused
                data[dstIdx + 3] = 255; // A — fully opaque
            }
        }

        ctx.putImageData(imageData, 0, 0);

        return {
            dataUrl: canvas.toDataURL(),
            scale: maxMag  // becomes the SVG filter's scale attribute
        };
    }

    /* ── Create an SVG filter element for a displacement map ── */

    function createSVGFilter(filterId, dataUrl, scale) {
        const filter = document.createElementNS(SVG_NS, 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('x', '-15%');
        filter.setAttribute('y', '-15%');
        filter.setAttribute('width', '130%');
        filter.setAttribute('height', '130%');
        filter.setAttribute('color-interpolation-filters', 'sRGB');

        const feImage = document.createElementNS(SVG_NS, 'feImage');
        feImage.setAttribute('href', dataUrl);
        feImage.setAttribute('x', '0%');
        feImage.setAttribute('y', '0%');
        feImage.setAttribute('width', '100%');
        feImage.setAttribute('height', '100%');
        feImage.setAttribute('preserveAspectRatio', 'none');
        feImage.setAttribute('result', 'dispMap');

        const feDisp = document.createElementNS(SVG_NS, 'feDisplacementMap');
        feDisp.setAttribute('in', 'SourceGraphic');
        feDisp.setAttribute('in2', 'dispMap');
        feDisp.setAttribute('scale', String(scale));
        feDisp.setAttribute('xChannelSelector', 'R');
        feDisp.setAttribute('yChannelSelector', 'G');

        filter.appendChild(feImage);
        filter.appendChild(feDisp);
        svgDefs.appendChild(filter);

        return filterId;
    }

    /* ── Get or create a filter for a given panel size ──────── */

    function getFilterForSize(w, h, cornerRadius) {
        const key = `${w}x${h}`;
        if (filterCache[key]) return filterCache[key];

        const { dataUrl, scale } = generateDisplacementMap(w, h, cornerRadius);
        const filterId = `glass-refract-${filterIdCounter++}`;
        createSVGFilter(filterId, dataUrl, scale);

        filterCache[key] = { filterId, dataUrl, scale };
        return filterCache[key];
    }

    /* ── Inject distorted background into a panel ──────────── */

    function addGlassLayer(panel) {
        const layer = document.createElement('div');
        layer.className = 'glass-bg-layer';

        const clone = document.createElement('div');
        clone.className = 'glass-bg-clone';

        layer.appendChild(clone);
        panel.prepend(layer);

        // Tint overlay — separate from filtered layer so it doesn't get warped
        const tint = document.createElement('div');
        tint.className = 'glass-bg-tint';
        panel.insertBefore(tint, layer.nextSibling);

        // Size the filter to the panel's rendered dimensions
        function applyFilter() {
            const rect = panel.getBoundingClientRect();
            const w = Math.round(rect.width);
            const h = Math.round(rect.height);
            if (w < 1 || h < 1) return;

            const borderRadius = parseInt(getComputedStyle(panel).borderRadius) || 20;
            const { filterId } = getFilterForSize(w, h, borderRadius);
            layer.style.filter = `url(#${filterId})`;
        }

        // Position the clone to align with body background
        function reposition() {
            const r = panel.getBoundingClientRect();
            clone.style.transform = `translate(${-r.left}px, ${-r.top}px)`;
        }

        applyFilter();
        reposition();
        positionUpdaters.push(reposition);
    }

    /* ── Set up glass on the main input panel ─────────────── */

    const inputPanel = document.querySelector('.input-panel');
    if (inputPanel) addGlassLayer(inputPanel);

    // Reposition all clones on scroll / resize
    let ticking = false;
    function onScrollResize() {
        if (!ticking) {
            requestAnimationFrame(() => {
                positionUpdaters.forEach(fn => fn());
                ticking = false;
            });
            ticking = true;
        }
    }
    window.addEventListener('scroll', onScrollResize, { passive: true });
    window.addEventListener('resize', onScrollResize);

    /* ─── Mouse-Following Specular Highlight ──────────────── */

    document.querySelectorAll('.glass-panel').forEach(panel => {
        panel.addEventListener('mousemove', e => {
            const r = panel.getBoundingClientRect();
            panel.style.setProperty('--mouse-x', `${((e.clientX - r.left) / r.width) * 100}%`);
            panel.style.setProperty('--mouse-y', `${((e.clientY - r.top) / r.height) * 100}%`);
        });
    });

    /* ─── Form Logic ─────────────────────────────────────── */

    const form = document.getElementById('messageForm');
    const nameInput = document.getElementById('nameInput');
    const gradeInput = document.getElementById('gradeInput');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const messageFeed = document.getElementById('messageFeed');

    function validateForm() {
        const ok = nameInput.value.trim() && gradeInput.value && messageInput.value.trim();
        sendBtn.disabled = !ok;
    }

    nameInput.addEventListener('input', validateForm);
    gradeInput.addEventListener('change', validateForm);
    messageInput.addEventListener('input', validateForm);

    /* ─── Messages ───────────────────────────────────────── */

    function escapeHtml(text) {
        const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, c => m[c]);
    }

    function loadMessages() {
        fetch('/api/responses')
            .then(r => r.json())
            .then(data => {
                messageFeed.innerHTML = '';
                if (!data.length) {
                    messageFeed.innerHTML = '<div class="loading">No messages yet. Be the first!</div>';
                    return;
                }
                data.forEach(msg => addMessageToFeed(msg));
                requestAnimationFrame(() => positionUpdaters.forEach(fn => fn()));
            })
            .catch(() => {
                messageFeed.innerHTML = '<div class="loading">Failed to load messages.</div>';
            });
    }

    function addMessageToFeed(msg) {
        const card = document.createElement('div');
        card.className = 'message-card';

        addGlassLayer(card);

        const date = new Date(msg.timestamp).toLocaleString([], {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const content = document.createElement('div');
        content.className = 'msg-content';
        content.innerHTML = `
            <div class="msg-header">
                <span class="msg-name">${escapeHtml(msg.name)}</span>
                <span class="msg-grade">Grade ${escapeHtml(msg.gradeLevel)}</span>
                <span class="msg-time">${date}</span>
            </div>
            <div class="msg-body">${escapeHtml(msg.message)}</div>
        `;
        card.appendChild(content);
        messageFeed.appendChild(card);
    }

    /* ─── Form Submission ────────────────────────────────── */

    form.addEventListener('submit', e => {
        e.preventDefault();

        const btnText = sendBtn.querySelector('.btn-text');
        const payload = {
            name: nameInput.value,
            gradeLevel: gradeInput.value,
            message: messageInput.value
        };

        sendBtn.disabled = true;
        btnText.textContent = 'Sending...';

        fetch('/api/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(async r => {
            if (!r.ok) throw new Error((await r.json()).error || 'Something went wrong');
            return r.json();
        })
        .then(() => {
            inputPanel.classList.add('success');
            setTimeout(() => inputPanel.classList.remove('success'), 700);

            nameInput.value = '';
            gradeInput.value = '';
            messageInput.value = '';
            validateForm();
            loadMessages();
            btnText.textContent = 'Submit';
        })
        .catch(err => {
            alert(err.message);
            sendBtn.disabled = false;
            btnText.textContent = 'Submit';
        });
    });

    /* ─── Init ───────────────────────────────────────────── */

    loadMessages();
    setInterval(loadMessages, 10000);
});

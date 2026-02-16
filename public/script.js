document.addEventListener('DOMContentLoaded', () => {

    /* ─── Mouse-Following Specular Highlight ──────────────── */

    function addSpecularTracking(el) {
        el.addEventListener('mousemove', e => {
            const r = el.getBoundingClientRect();
            el.style.setProperty('--mouse-x', `${((e.clientX - r.left) / r.width) * 100}%`);
            el.style.setProperty('--mouse-y', `${((e.clientY - r.top) / r.height) * 100}%`);
        });
    }

    document.querySelectorAll('.glass-panel').forEach(addSpecularTracking);

    /* ─── Form Logic ─────────────────────────────────────── */

    const form = document.getElementById('messageForm');
    const nameInput = document.getElementById('nameInput');
    const gradeInput = document.getElementById('gradeInput');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const messageFeed = document.getElementById('messageFeed');
    const inputPanel = document.querySelector('.input-panel');

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
            })
            .catch(() => {
                messageFeed.innerHTML = '<div class="loading">Failed to load messages.</div>';
            });
    }

    function addMessageToFeed(msg) {
        const card = document.createElement('div');
        card.className = 'message-card';

        const date = new Date(msg.timestamp).toLocaleString([], {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        card.innerHTML = `
            <div class="msg-content">
                <div class="msg-header">
                    <span class="msg-name">${escapeHtml(msg.name)}</span>
                    <span class="msg-grade">Grade ${escapeHtml(msg.gradeLevel)}</span>
                    <span class="msg-time">${date}</span>
                </div>
            </div>
        `;
        addSpecularTracking(card);
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

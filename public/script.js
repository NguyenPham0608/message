document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('messageForm');
    const nameInput = document.getElementById('nameInput');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const validationMessage = document.getElementById('validationMessage');
    const messageFeed = document.getElementById('messageFeed');

    // Simple list of negative words for client-side feedback
    // The server handles a more robust check using 'bad-words'
    const negativeWords = ['bad', 'hate', 'ugly', 'stupid', 'awful', 'terrible', 'worst'];

    function loadMessages() {
        fetch('/api/messages')
            .then(res => res.json())
            .then(data => {
                messageFeed.innerHTML = '';
                if (data.length === 0) {
                    messageFeed.innerHTML = '<div class="loading">No messages yet. Be the first!</div>';
                    return;
                }
                data.forEach(msg => addMessageToFeed(msg));
            })
            .catch(err => {
                console.error('Error fetching messages:', err);
                messageFeed.innerHTML = '<div class="loading">Failed to load messages.</div>';
            });
    }

    function addMessageToFeed(msg) {
        const div = document.createElement('div');
        div.className = 'message-card';
        
        const date = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.innerHTML = `
            <div class="msg-header">
                <span class="msg-name">${escapeHtml(msg.name)}</span>
                <span class="msg-time">${date}</span>
            </div>
            <div class="msg-body">${escapeHtml(msg.text)}</div>
        `;
        messageFeed.appendChild(div);
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function validateInput() {
        const text = messageInput.value;
        const lowerText = text.toLowerCase();
        let isValid = true;
        let errorMsg = '';

        if (text.trim().length === 0) {
            isValid = false;
            // No error message for empty, just disabled button
        } else {
            // Check for negative words
            const foundBadWord = negativeWords.find(word => lowerText.includes(word));
            if (foundBadWord) {
                isValid = false;
                errorMsg = `Let's keep it positive! Please remove negative words like "${foundBadWord}".`;
            }
        }

        if (isValid) {
            sendBtn.disabled = false;
            validationMessage.textContent = '';
            messageInput.style.borderColor = 'var(--success-color)';
        } else {
            sendBtn.disabled = true;
            validationMessage.textContent = errorMsg;
            if (errorMsg) {
                messageInput.style.borderColor = 'var(--error-color)';
            } else {
                messageInput.style.borderColor = ''; // Reset if just empty
            }
        }
    }

    messageInput.addEventListener('input', validateInput);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const payload = {
            name: nameInput.value,
            text: messageInput.value
        };

        // Optimistic UI update (optional, but nice)
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Something went wrong');
            }
            return res.json();
        })
        .then(newMsg => {
            messageInput.value = '';
            validateInput(); // Reset validation state
            loadMessages(); // Refresh feed
            sendBtn.textContent = 'Send Positivity';
        })
        .catch(err => {
            alert(err.message);
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Positivity';
        });
    });

    // Initial load
    loadMessages();
    
    // Poll for new messages every 10 seconds
    setInterval(loadMessages, 10000);
});

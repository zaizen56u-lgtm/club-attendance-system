let myRole = '';
let lastMessageCount = 0;
let lastPresetHash = '';

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function selectRole(role) {
    myRole = role;
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('role-display').innerText = `担当: ${role}`;
    fetchState();
}

function sendChatMessage() {
    if (!myRole) return;
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SEND_CHAT', payload: { sender: myRole, message: message } })
    });
    input.value = '';
}

function sendPreset(text) {
    if (!myRole) return;
    fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SEND_CHAT', payload: { sender: myRole, message: text } })
    });
}

function setRetry(team, type) {
    fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_RETRY', payload: { team, type } })
    });
}

function clearRetry(team) {
    fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEAR_RETRY', payload: { team } })
    });
}

async function fetchState() {
    if (!myRole) return; // Don't fetch if role is not selected
    try {
        const res = await fetch('/api/state');
        const state = await res.json();
        
        // Update Score and Timer
        document.getElementById('score-left').innerText = state.scoreLeft || 0;
        document.getElementById('score-right').innerText = state.scoreRight || 0;
        
        document.getElementById('name-left').innerText = state.nameLeft || '赤チーム';
        document.getElementById('name-right').innerText = state.nameRight || '青チーム';
        
        const updateRetry = (team, status, penTimer) => {
            const el = document.getElementById(`retry-${team}`);
            const penEl = document.getElementById(`penalty-${team}`);
            if (status) {
                el.style.display = 'inline-block';
                el.innerText = status;
                el.style.background = '#eab308';
                el.style.borderColor = '#facc15';
                
                if (status === '強制リトライ' && penTimer > 0) {
                    penEl.style.display = 'block';
                    penEl.innerText = penTimer + 's';
                } else {
                    penEl.style.display = 'none';
                }
            } else {
                el.style.display = 'none';
                penEl.style.display = 'none';
            }
        };
        updateRetry('left', state.retryStatusLeft, state.penaltyTimerLeft);
        updateRetry('right', state.retryStatusRight, state.penaltyTimerRight);
        
        const timerDisplay = document.getElementById('timer-display');
        timerDisplay.innerText = formatTime(state.elapsedTime);
        if (state.isRunning) {
            timerDisplay.style.color = '#ef4444';
        } else {
            timerDisplay.style.color = '#fff';
        }
        
        // Update Chat
        if (state.chatMessages && state.chatMessages.length !== lastMessageCount) {
            const container = document.getElementById('chat-messages');
            container.innerHTML = '';
            state.chatMessages.forEach(msg => {
                const div = document.createElement('div');
                div.className = msg.sender === myRole ? 'chat-msg self' : 'chat-msg other';
                const time = new Date(msg.time).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'});
                div.innerHTML = `<span class="chat-sender">${msg.sender} (${time})</span> <span class="chat-text">${msg.message}</span>`;
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
            lastMessageCount = state.chatMessages.length;
        }

        // Update Presets
        if (state.presetMessages) {
            const currentHash = state.presetMessages.join('|');
            if (currentHash !== lastPresetHash) {
                const presetArea = document.getElementById('preset-area');
                presetArea.innerHTML = '';
                state.presetMessages.forEach(msg => {
                    const btn = document.createElement('button');
                    btn.className = 'preset-btn';
                    btn.innerText = msg;
                    btn.onclick = () => sendPreset(msg);
                    presetArea.appendChild(btn);
                });
                lastPresetHash = currentHash;
            }
        }
    } catch (e) {
        console.error('Failed to fetch state:', e);
    }
}

setInterval(fetchState, 1000);

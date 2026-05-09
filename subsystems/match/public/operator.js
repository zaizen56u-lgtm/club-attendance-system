function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

let lastPointKeys = '';
let lastMessageCount = 0;
let lastPresetHash = '';

let lastCountdownId = 0;
let countdownAudioEl = new Audio('custom_buzzer.mp3');

function handleStartClick() {
    countdownAudioEl.play().then(() => {
        countdownAudioEl.pause();
        countdownAudioEl.currentTime = 0;
    }).catch(e => console.error(e));
    
    sendAction('COUNTDOWN_START');
}

function triggerCountdownSound() {
    countdownAudioEl.currentTime = 0;
    countdownAudioEl.play().catch(e => console.error("Audio play failed:", e));
}

async function sendAction(action, payload = null) {
    await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
    });
    fetchState();
}

function updateBreakdown(team, item, change) {
    sendAction('UPDATE_BREAKDOWN', { team, item, change });
}

function updateBreakdownBool(team, item, value) {
    sendAction('UPDATE_BREAKDOWN', { team, item, value });
}

function sendName(action, name) {
    sendAction(action, name);
}

function saveMatchResults() {
    fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SAVE_RESULTS' })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            alert('試合結果をExcelに保存しました！');
        } else {
            alert('エラーが発生しました: ' + (data.error || ''));
        }
    });
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SEND_CHAT', payload: { sender: 'タイマー運営', message: message } })
    });
    input.value = '';
}

function sendPreset(text) {
    fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SEND_CHAT', payload: { sender: 'タイマー運営', message: text } })
    });
}

function setRetry(team, type) {
    sendAction('SET_RETRY', { team, type });
}

function clearRetry(team) {
    sendAction('CLEAR_RETRY', { team });
}

let currentTeamList = [];

// サーバーから状態を取得してプレビューを更新 (500msごと)
async function fetchState() {
    try {
        const res = await fetch('/api/state');
        const state = await res.json();

        document.getElementById('op-timer-display').innerText = formatTime(state.elapsedTime);
        document.getElementById('op-score-left').innerText = state.scoreLeft;
        document.getElementById('op-score-right').innerText = state.scoreRight;
        
        const inL = document.getElementById('input-name-left');
        const inR = document.getElementById('input-name-right');

        if (JSON.stringify(currentTeamList) !== JSON.stringify(state.teamList)) {
            currentTeamList = state.teamList;
            const optionsHtml = currentTeamList.map(t => `<option value="${t}">${t}</option>`).join('');
            if(inL) inL.innerHTML = optionsHtml;
            if(inR) inR.innerHTML = optionsHtml;
        }

        if (document.activeElement !== inL) inL.value = state.nameLeft;
        if (document.activeElement !== inR) inR.value = state.nameRight;

        // Dynamic Breakdown UI Generation
        const normalTbody = document.getElementById('normal-scores-tbody');
        const specialTbody = document.getElementById('special-scores-tbody');
        
        if (state.points && state.itemNames) {
            // 現在描画されているキーと一致するか確認し、一致しなければ再構築
            const currentKeys = Array.from(normalTbody.querySelectorAll('tr[data-key]')).concat(Array.from(specialTbody.querySelectorAll('tr[data-key]'))).map(tr => tr.getAttribute('data-key'));
            const newKeys = Object.keys(state.points);
            
            if (JSON.stringify(currentKeys.sort()) !== JSON.stringify(newKeys.sort())) {
                // Clear existing rows except the first header row
                const normalHeader = normalTbody.firstElementChild;
                const specialHeader = specialTbody.firstElementChild;
                normalTbody.innerHTML = '';
                specialTbody.innerHTML = '';
                if(normalHeader) normalTbody.appendChild(normalHeader);
                if(specialHeader) specialTbody.appendChild(specialHeader);

                newKeys.forEach(k => {
                    const isSpecial = state.limits && state.limits[k] !== undefined;
                    const tr = document.createElement('tr');
                    tr.setAttribute('data-key', k);
                    
                    const tdLeft = document.createElement('td');
                    tdLeft.className = 'col-red';
                    tdLeft.innerHTML = `
                        <div class="bd-controls">
                            <button class="bd-btn" onclick="updateBreakdown('left', '${k}', -1)">-</button>
                            <span class="bd-val" id="bd-l-${k}">0</span>
                            <button class="bd-btn" onclick="updateBreakdown('left', '${k}', 1)">+</button>
                        </div>
                    `;
                    
                    const tdCenter = document.createElement('td');
                    tdCenter.className = 'col-item';
                    if (isSpecial) {
                        tdCenter.innerHTML = `<span id="disp-name-${k}">${state.itemNames[k]}</span><br><span style="font-size: 1rem; color:#aaa;">(上限 <span id="disp-lim-${k}">${state.limits[k]}</span>回 / 1回につき<span id="disp-pt-${k}">${state.points[k]}</span>点)</span>`;
                    } else {
                        tdCenter.innerHTML = `<span id="disp-name-${k}">${state.itemNames[k]}</span><br><span style="font-size: 1rem; color:#aaa;">(1回につき<span id="disp-pt-${k}">${state.points[k]}</span>点)</span>`;
                    }
                    
                    const tdRight = document.createElement('td');
                    tdRight.className = 'col-blue';
                    tdRight.innerHTML = `
                        <div class="bd-controls">
                            <button class="bd-btn" onclick="updateBreakdown('right', '${k}', -1)">-</button>
                            <span class="bd-val" id="bd-r-${k}">0</span>
                            <button class="bd-btn" onclick="updateBreakdown('right', '${k}', 1)">+</button>
                        </div>
                    `;
                    
                    tr.appendChild(tdLeft);
                    tr.appendChild(tdCenter);
                    tr.appendChild(tdRight);
                    
                    if (isSpecial) {
                        specialTbody.appendChild(tr);
                    } else {
                        normalTbody.appendChild(tr);
                    }
                });
            }
        }

        // Breakdown UI Value Update
        if (state.points) {
            Object.keys(state.points).forEach(k => {
                const bdL = document.getElementById(`bd-l-${k}`);
                const bdR = document.getElementById(`bd-r-${k}`);
                const nameEl = document.getElementById(`disp-name-${k}`);
                const ptEl = document.getElementById(`disp-pt-${k}`);
                const limEl = document.getElementById(`disp-lim-${k}`);
                
                if (bdL && state.breakdownLeft) bdL.innerText = state.breakdownLeft[k] || 0;
                if (bdR && state.breakdownRight) bdR.innerText = state.breakdownRight[k] || 0;
                if (nameEl && state.itemNames) nameEl.innerText = state.itemNames[k];
                if (ptEl) ptEl.innerText = state.points[k];
                if (limEl && state.limits) limEl.innerText = state.limits[k];
            });
        }

        // Timer color based on running state
        const timerDisplay = document.getElementById('op-timer-display');
        if (state.isRunning) {
            timerDisplay.style.color = '#ef4444';
        } else {
            timerDisplay.style.color = '#fff';
        }
        
        // Update chat
        if (state.chatMessages && state.chatMessages.length !== lastMessageCount) {
            const container = document.getElementById('chat-messages');
            container.innerHTML = '';
            state.chatMessages.forEach(msg => {
                const div = document.createElement('div');
                div.className = msg.sender === 'タイマー運営' ? 'chat-msg self' : 'chat-msg other';
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

        // Winner Highlight
        const boxL = document.getElementById('op-box-left');
        const boxR = document.getElementById('op-box-right');
        if (state.winner === 'left') {
            boxL.classList.add('winner');
            boxR.classList.remove('winner');
        } else if (state.winner === 'right') {
            boxR.classList.add('winner');
            boxL.classList.remove('winner');
        } else {
            boxL.classList.remove('winner');
            boxR.classList.remove('winner');
        }

        // Retry UI Updates
        const updateRetry = (team, status, penTimer) => {
            const el = document.getElementById(`retry-${team}`);
            const penEl = document.getElementById(`op-penalty-${team}`);
            if (status) {
                el.style.display = 'block';
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

    } catch (err) {
        console.error("サーバー通信エラー", err);
    }
}

setInterval(fetchState, 500);
fetchState();

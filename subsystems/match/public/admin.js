async function sendAction(action, payload = null) {
    await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
    });
    fetchState();
}

function sendName(action, name) {
    sendAction(action, name);
}

function setTargetTime() {
    const input = prompt("終了する時間を「分」で入力してください (例: 5)\n※ 0を入力すると無制限になります");
    if (input !== null && !isNaN(input) && input >= 0) {
        sendAction('SET_TARGET', Math.floor(input * 60));
        alert(input > 0 ? `${input}分で自動停止するように設定しました。` : `時間無制限に設定しました。`);
    }
}

function checkAdminPassword() {
    const pw = document.getElementById('admin-pw').value;
    if (pw === "51068010A") {
        document.getElementById("login-overlay").style.display = "none";
        document.getElementById("admin-main-content").style.display = "flex";
    } else {
        alert("パスワードが違います。");
    }
}

document.getElementById('admin-pw')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkAdminPassword();
});

function updateTeamList() {
    const text = document.getElementById('team-list-textarea').value;
    const list = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    sendAction('UPDATE_TEAM_LIST', list);
    alert('チームリストを保存しました。ドロップダウンの選択肢が更新されました。');
}

function updatePresetList() {
    const text = document.getElementById('preset-list-textarea').value;
    const list = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    sendAction('UPDATE_PRESETS', list);
    alert('連絡チャットの定型文を保存しました。');
}

// 動的得点管理用変数
let localPoints = {};
let localNames = {};
let localLimits = {};

function renderScoreInputs() {
    const normalContainer = document.getElementById('normal-scores-container');
    const specialContainer = document.getElementById('special-scores-container');
    
    normalContainer.innerHTML = '';
    specialContainer.innerHTML = '';
    
    let normalCount = 1;
    let specialCount = 1;
    
    Object.keys(localPoints).forEach(key => {
        const isSpecial = localLimits[key] !== undefined;
        
        const div = document.createElement('div');
        div.style.background = '#333';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.position = 'relative';
        
        const label = document.createElement('label');
        label.style.color = '#aaa';
        label.style.fontSize = '0.9rem';
        label.innerText = isSpecial ? `特殊${specialCount++} (ID: ${key})` : `項目${normalCount++} (ID: ${key})`;
        div.appendChild(label);
        
        const delBtn = document.createElement('button');
        delBtn.innerText = '削除';
        delBtn.style.position = 'absolute';
        delBtn.style.right = '5px';
        delBtn.style.top = '5px';
        delBtn.style.background = '#ef4444';
        delBtn.style.color = 'white';
        delBtn.style.border = 'none';
        delBtn.style.borderRadius = '3px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '0.7rem';
        delBtn.onclick = () => {
            if(confirm(`項目「${localNames[key]}」を削除しますか？`)) {
                delete localPoints[key];
                delete localNames[key];
                if(localLimits[key] !== undefined) delete localLimits[key];
                unsavedChanges = true;
                renderScoreInputs();
            }
        };
        div.appendChild(delBtn);
        
        const flex = document.createElement('div');
        flex.style.display = 'flex';
        flex.style.gap = '5px';
        flex.style.marginTop = '5px';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'admin-input';
        nameInput.style.marginBottom = '0';
        nameInput.style.flex = '2';
        nameInput.placeholder = '項目名';
        nameInput.value = localNames[key];
        nameInput.onchange = (e) => { localNames[key] = e.target.value; unsavedChanges = true; };
        flex.appendChild(nameInput);
        
        const ptInput = document.createElement('input');
        ptInput.type = 'number';
        ptInput.className = 'admin-input';
        ptInput.style.marginBottom = '0';
        ptInput.style.flex = '1';
        ptInput.title = '1回あたりの得点';
        ptInput.placeholder = '得点';
        ptInput.value = localPoints[key];
        ptInput.onchange = (e) => { localPoints[key] = parseInt(e.target.value, 10) || 0; unsavedChanges = true; };
        flex.appendChild(ptInput);
        
        if (isSpecial) {
            const limInput = document.createElement('input');
            limInput.type = 'number';
            limInput.className = 'admin-input';
            limInput.style.marginBottom = '0';
            limInput.style.flex = '1';
            limInput.title = '上限回数';
            limInput.placeholder = '上限';
            limInput.value = localLimits[key];
            limInput.onchange = (e) => { localLimits[key] = parseInt(e.target.value, 10) || 1; unsavedChanges = true; };
            flex.appendChild(limInput);
            specialContainer.appendChild(div);
        } else {
            normalContainer.appendChild(div);
        }
        
        div.appendChild(flex);
    });
}

function generateNewId() {
    return 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

function addNormalScore() {
    const id = generateNewId();
    localPoints[id] = 10;
    localNames[id] = '新規項目';
    unsavedChanges = true;
    renderScoreInputs();
}

function addSpecialScore() {
    const id = generateNewId();
    localPoints[id] = 100;
    localNames[id] = '新規特殊項目';
    localLimits[id] = 1;
    unsavedChanges = true;
    renderScoreInputs();
}

function updateRules() {
    const payload = {
        points: localPoints,
        limits: localLimits,
        itemNames: localNames
    };
    sendAction('UPDATE_RULES', payload);
    unsavedChanges = false;
    alert('項目名、得点配分、上限回数を保存しました。');
}

let currentTeamList = [];
let isEditingFields = false;
let unsavedChanges = false;

document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        isEditingFields = true;
    }
});

document.addEventListener('focusout', (e) => {
    isEditingFields = false;
});

// サーバーから状態を取得してプレビューを更新
async function fetchState() {
    try {
        const res = await fetch('/api/state');
        const state = await res.json();
        
        if (!isEditingFields && !unsavedChanges) {
            // ローカルステートの更新
            if (state.points && state.itemNames) {
                // To avoid destroying user input, only copy if not actively editing
                localPoints = { ...state.points };
                localNames = { ...state.itemNames };
                localLimits = { ...state.limits };
                renderScoreInputs();
            }
            
            const inL = document.getElementById('input-name-left');
            const inR = document.getElementById('input-name-right');
            const ta = document.getElementById('team-list-textarea');

            if (JSON.stringify(currentTeamList) !== JSON.stringify(state.teamList)) {
                currentTeamList = state.teamList || [];
                const optionsHtml = currentTeamList.map(t => `<option value="${t}">${t}</option>`).join('');
                if(inL) inL.innerHTML = optionsHtml;
                if(inR) inR.innerHTML = optionsHtml;
                if(ta) ta.value = currentTeamList.join('\n');
            }
            
            const pta = document.getElementById('preset-list-textarea');
            if (pta && state.presetMessages && pta.value === '' && !isEditingFields) {
                pta.value = state.presetMessages.join('\n');
            }

            if (inL) inL.value = state.nameLeft;
            if (inR) inR.value = state.nameRight;
        }

    } catch (err) {
        console.error("サーバー通信エラー", err);
    }
}

setInterval(fetchState, 1000);
fetchState();

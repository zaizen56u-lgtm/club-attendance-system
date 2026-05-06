function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateFontSize(element) {
    const len = element.innerText.length;
    if (len <= 6) element.style.fontSize = '4.5rem'; 
    else if (len <= 9) element.style.fontSize = '3.5rem';
    else if (len <= 13) element.style.fontSize = '2.4rem';
    else element.style.fontSize = '1.8rem';
}

// サーバーから状態を取得してボードを更新 (毎秒4回 = 250ms)
let lastCountdownId = 0;
let isFirstLoad = true;
let countdownAudioEl = new Audio('custom_buzzer.mp3');
let beepOffset = 0;

// 自動的に無音部分をカットするロジック（音声ファイルの中で最初に大きな音が鳴る位置を特定）
fetch('custom_buzzer.mp3')
    .then(res => res.arrayBuffer())
    .then(buf => {
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        return tempCtx.decodeAudioData(buf);
    })
    .then(audioBuf => {
        const data = audioBuf.getChannelData(0);
        let maxVal = 0;
        for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > maxVal) maxVal = Math.abs(data[i]);
        
        const threshold = maxVal * 0.3; // 最大音量の30%を閾値とする
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i]) > threshold) {
                // 音の始まる0.05秒前から再生を開始する
                beepOffset = Math.max(0, (i / audioBuf.sampleRate) - 0.05);
                console.log("音声の自動カット位置:", beepOffset, "秒");
                break;
            }
        }
    }).catch(e => console.error("自動カット処理エラー:", e));

document.getElementById('unlock-audio-overlay').addEventListener('click', function() {
    countdownAudioEl.play().then(() => {
        countdownAudioEl.pause();
        countdownAudioEl.currentTime = beepOffset;
    }).catch(e => console.error(e));
    this.style.display = 'none';
});

function triggerCountdownSound() {
    countdownAudioEl.currentTime = beepOffset;
    countdownAudioEl.play().catch(e => console.error("Audio play failed:", e));
}

setInterval(async () => {
    try {
        const res = await fetch('/api/state');
        const state = await res.json();

        // タイマー更新
        document.getElementById('main-timer').innerText = formatTime(state.elapsedTime);

        // スコア更新
        document.getElementById('score-left').innerText = state.scoreLeft;
        document.getElementById('score-right').innerText = state.scoreRight;

        // 名前更新
        const nameL = document.getElementById('name-left');
        const nameR = document.getElementById('name-right');
        if (nameL.innerText !== state.nameLeft) {
            nameL.innerText = state.nameLeft;
            updateFontSize(nameL);
        }
        if (nameR.innerText !== state.nameRight) {
            nameR.innerText = state.nameRight;
            updateFontSize(nameR);
        }

        // ハイライト更新
        const boxL = document.getElementById('box-left');
        const boxR = document.getElementById('box-right');
        
        boxL.classList.remove('winner');
        boxR.classList.remove('winner');
        
        if (state.winner === 'left') {
            boxL.classList.add('winner');
        } else if (state.winner === 'right') {
            boxR.classList.add('winner');
        }

        const updateRetry = (team, status, penTimer) => {
            const el = document.getElementById(`retry-${team}`);
            const penEl = document.getElementById(`penalty-${team}`);
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

        // カウントダウンサウンドの再生
        if (state.countdownTriggerId !== undefined) {
            if (isFirstLoad) {
                lastCountdownId = state.countdownTriggerId;
                isFirstLoad = false;
            } else if (state.countdownTriggerId !== lastCountdownId) {
                lastCountdownId = state.countdownTriggerId;
                triggerCountdownSound();
            }
        }

    } catch (err) {
        console.error("サーバー通信エラー", err);
    }
}, 250);

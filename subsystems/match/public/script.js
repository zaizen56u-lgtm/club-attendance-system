let scores = {
    left: 0,
    right: 0
};

// スコアの更新
function updateScore(team, amount) {
    scores[team] += amount;
    if (scores[team] < 0) scores[team] = 0; // マイナスにはしない
    
    document.getElementById(`score-${team}`).innerText = scores[team];
}

// 勝敗判定（黄色ハイライト）
document.getElementById('btn-judge').addEventListener('click', () => {
    const boxLeft = document.getElementById('box-left');
    const boxRight = document.getElementById('box-right');
    
    // 一旦両方クリア
    boxLeft.classList.remove('winner');
    boxRight.classList.remove('winner');

    if (scores.left > scores.right) {
        boxLeft.classList.add('winner');
    } else if (scores.right > scores.left) {
        boxRight.classList.add('winner');
    }
    // 同点の場合はハイライトしない
});

// 勝敗判定のクリア
document.getElementById('btn-clear-judge').addEventListener('click', () => {
    document.getElementById('box-left').classList.remove('winner');
    document.getElementById('box-right').classList.remove('winner');
});


// ==========================================
// タイマーロジック (カウントアップ方式)
// ==========================================
let timerInterval;
let elapsedTime = 0; // 経過時間 (秒)
let targetTime = 180; // 目標終了時間: デフォルト3分 (180秒)
const timerDisplay = document.getElementById('main-timer');

// 秒数を M:SS 形式に変換
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

document.getElementById('btn-play').addEventListener('click', () => {
    if (timerInterval) return; // 既に動いている場合は無視
    timerInterval = setInterval(() => {
        elapsedTime++;
        timerDisplay.innerText = formatTime(elapsedTime);
        
        // 目標時間に達したかチェック
        if (targetTime > 0 && elapsedTime >= targetTime) {
            clearInterval(timerInterval);
            timerInterval = null;
            // 目標時間に達したら自動で勝敗判定を行う
            document.getElementById('btn-judge').click();
        }
    }, 1000);
});

document.getElementById('btn-pause').addEventListener('click', () => {
    clearInterval(timerInterval);
    timerInterval = null;
});

document.getElementById('btn-reset').addEventListener('click', () => {
    clearInterval(timerInterval);
    timerInterval = null;
    elapsedTime = 0;
    timerDisplay.innerText = formatTime(elapsedTime);
    // 勝敗ハイライトもクリア
    document.getElementById('btn-clear-judge').click();
});

document.getElementById('btn-set-time').addEventListener('click', () => {
    const input = prompt("終了する時間を「分」で入力してください (例: 5)\n※ 0を入力すると無制限（手動停止）になります", Math.floor(targetTime / 60));
    if (input !== null && !isNaN(input) && input >= 0) {
        targetTime = Math.floor(input * 60);
        alert(targetTime > 0 ? `${input}分で自動停止するように設定しました。` : `時間無制限に設定しました。`);
    }
});

// 初期表示のセット
timerDisplay.innerText = formatTime(elapsedTime);

// ==========================================
// チーム名の自動フォントサイズ調整
// 13文字を1行で綺麗に収めるための処理
// ==========================================
const teamNameInputs = document.querySelectorAll('.team-name');
teamNameInputs.forEach(input => {
    input.addEventListener('input', function() {
        const len = this.value.length;
        if (len <= 6) {
            this.style.fontSize = '3.5rem';
        } else if (len <= 9) {
            this.style.fontSize = '2.8rem';
        } else if (len <= 13) {
            this.style.fontSize = '2.2rem';
        } else {
            this.style.fontSize = '1.8rem';
        }
    });
    // 初期状態でもサイズを合わせるためにイベントを発火
    input.dispatchEvent(new Event('input'));
});

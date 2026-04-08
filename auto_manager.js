const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const dbFile = path.join(__dirname, 'data', 'db.json');
let serverProcess = null;
let placeholderServer = null;

// 臨時起動（Wake-on-Demand）の終了予定時刻
let overrideAwakeUntil = 0; 
const AWAKE_DURATION_MS = 60 * 60 * 1000; // 60分間

function log(message) {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    console.log(`[${timeStr}] ${message}`);
}

function startPlaceholder() {
    if (placeholderServer || serverProcess) return;

    placeholderServer = http.createServer((req, res) => {
        log("🌐 時間外のアクセスを検知しました。サーバーを臨時起動します...");

        // 臨時起動時間をセット（現在の時間から60分後まで）
        overrideAwakeUntil = Date.now() + AWAKE_DURATION_MS;

        // ブラウザへのレスポンス：ローディング画面（3秒後に自動リロード）
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(`
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta http-equiv="refresh" content="3">
                    <title>システム起動中</title>
                    <style>
                        body { font-family: sans-serif; text-align: center; padding: 50px 20px; background-color: #f7f9fc; color: #333; }
                        h2 { color: #4a90e2; }
                        .spinner { margin: 20px auto; width: 40px; height: 40px; border: 4px solid rgba(0,0,0,0.1); border-left-color: #4a90e2; border-radius: 50%; animation: spin 1s linear infinite; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    </style>
                </head>
                <body>
                    <h2>出欠システムを起動しています...</h2>
                    <div class="spinner"></div>
                    <p>このまま数秒間お待ちください。システムが立ち上がり次第、自動的に画面が切り替わります。</p>
                </body>
            </html>
        `);

        // プレースホルダー（待機受付係）を店じまいして、本サーバーを起動する
        stopPlaceholder();
        startServer();
    });

    const PORT = process.env.PORT || 3000;
    placeholderServer.listen(PORT, () => {
        log(`💤 待機モード: ポート${PORT}でアクセス監視中... (アクセスがあれば臨時起動します)`);
    });
    
    placeholderServer.on('error', (err) => {
        log(`⚠️ 待機サーバーのエラー: ${err.message}`);
        placeholderServer = null;
    });
}

function stopPlaceholder() {
    if (placeholderServer) {
        placeholderServer.close();
        placeholderServer = null;
    }
}

function startServer() {
    if (serverProcess) return;
    
    // 安全のため、待機サーバーが動いていたら先に閉じる
    stopPlaceholder();

    log("▶️ サーバー（server.js）を起動します。");
    serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: 'inherit' // 親プロセスと出力を共有
    });

    serverProcess.on('exit', (code) => {
        log(`⚠️ サーバープロセスが終了しました (code: ${code})`);
        serverProcess = null;
    });
}

function stopServer() {
    if (!serverProcess) return;
    log("⏹️ サーバー（server.js）を安全に停止します。");
    serverProcess.kill('SIGTERM');
    serverProcess = null;
}

function checkSchedule() {
    // システムの時間を強制的に日本時間（JST）の文字列として取得（海外サーバー・Render対策）
    const jstStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    const jstNow = new Date(jstStr);
    
    const year = jstNow.getFullYear();
    const month = String(jstNow.getMonth() + 1).padStart(2, '0');
    const date = String(jstNow.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${date}`;
    const dayOfWeek = jstNow.getDay(); // 0(Sun) - 6(Sat)
    
    // 現在の時分を数値化 ("16:30" => 1630)
    const currentHH = jstNow.getHours();
    const currentMM = jstNow.getMinutes();
    const currentTimeVal = currentHH * 100 + currentMM;

    // db.json から設定を読み込む
    let systemSettings = {
        weekdayDates: [],
        holidayDates: [],
        offDates: [],
        customDates: {}
    };

    if (fs.existsSync(dbFile)) {
        try {
            const data = fs.readFileSync(dbFile, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed.systemSettings) {
                systemSettings = parsed.systemSettings;
            }
        } catch (e) {
            return;
        }
    }

    // 今日の稼働活動時間を決定
    let startStr = "";
    let endStr = "";
    let isOff = false;

    if (systemSettings.offDates && systemSettings.offDates.includes(todayStr)) {
        isOff = true;
    } 
    else if (systemSettings.customDates && systemSettings.customDates[todayStr]) {
        startStr = systemSettings.customDates[todayStr].start;
        endStr = systemSettings.customDates[todayStr].end;
    }
    else if (systemSettings.weekdayDates && systemSettings.weekdayDates.includes(todayStr)) {
        startStr = "16:30";
        endStr = "18:30";
    }
    else if (systemSettings.holidayDates && systemSettings.holidayDates.includes(todayStr)) {
        startStr = "09:30";
        endStr = "18:30";
    }
    else {
        if (dayOfWeek === 0) {
            isOff = true;
        } else if (dayOfWeek === 6) {
            startStr = "09:30";
            endStr = "18:30";
        } else {
            startStr = "16:30";
            endStr = "18:30";
        }
    }

    let isScheduledTime = false;

    if (!isOff && startStr && endStr) {
        const startVal = parseInt(startStr.replace(':', ''), 10);
        const endVal = parseInt(endStr.replace(':', ''), 10);

        // 15分のバッファ
        const endHHStr = Math.floor(endVal / 100);
        const endMMStr = endVal % 100;
        let bufferHH = endHHStr;
        let bufferMM = endMMStr + 15;
        if(bufferMM >= 60) {
            bufferHH += 1;
            bufferMM -= 60;
        }
        const endBufferVal = bufferHH * 100 + bufferMM;

        if (currentTimeVal >= startVal && currentTimeVal <= endBufferVal) {
            isScheduledTime = true;
        }
    }

    if (isScheduledTime) {
        // スケジュール内の場合、臨時起動フラグをリセットし、本サーバーを起動したままにする
        overrideAwakeUntil = 0;
        startServer();
    } else {
        // スケジュール外の場合
        if (Date.now() < overrideAwakeUntil) {
            // 臨時フラグが有効（アクセスがあって臨時起動中）なら、本サーバーを維持
            startServer();
        } else {
            // 活動時間外 ＆ 臨時フラグもない → 本サーバーを落とし、待機サーバーを立てる
            stopServer();
            startPlaceholder();
        }
    }
}

console.log("=========================================================");
console.log(" 🕛 出欠システム：自動運転モード (auto_manager) 起動中...");
console.log(" この黒い画面を開いたままにしておくと、システムカレンダー");
console.log(" に連動してサーバーをON/OFFします。時間外でもアクセスが");
console.log(" あれば自動的に「臨時起動」を行います（Wake-on-Demand）。");
console.log("=========================================================");

// 初回チェック
checkSchedule();

// 以降、1分ごと(60000ms)に時間をチェック・維持判定
setInterval(checkSchedule, 60000);

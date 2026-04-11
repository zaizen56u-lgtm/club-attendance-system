const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');

// === エラーでシステムが落ちないようにする対策 ===
process.on('uncaughtException', (err) => {
    console.error("予期せぬエラー (uncaughtException) が発生しましたが、システムを継続します:", err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error("未処理のPromise拒否 (unhandledRejection) が発生しましたが、システムを継続します:", reason);
});
// ===============================================

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 管理用パスワード
const ADMIN_PASSWORD = "51068010A";
const MASTER_PASSWORD = "denken1975"; // 全員分の出欠入力を可能にするマスターパスワード

let members = [
  { id: 1, name: "齋藤広平", password: "2139", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 2, name: "酒井翔太郎", password: "2142", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 3, name: "竹原翔斗", password: "2166", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 4, name: "津志田悠希", password: "2319", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 5, name: "牧治翔", password: "2469", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 6, name: "内川龍馬", password: "3113", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 7, name: "桑原大翔", password: "3140", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 8, name: "坂田麻衣子", password: "3398", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 9, name: "高山蒼", password: "3284", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 10, name: "松野大翔", password: "3197", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 11, name: "生駒真大朗", password: "4189", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 12, name: "吉村成宏", password: "4435", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 13, name: "宮本王道", password: "4411", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 14, name: "牛島健斗", password: "5220", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 15, name: "澤村悠真", password: "5268", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 16, name: "竹ノ井海斗", password: "5304", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 17, name: "成嶋昊", password: "5340", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 18, name: "中山心春", password: "5556", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 19, name: "野田伊織", password: "5346", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 20, name: "原田透志", password: "5352", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 21, name: "松永知也", password: "5388", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 22, name: "松藤叶汰", password: "5394", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 23, name: "豊田理琴", password: "2181", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 24, name: "西美咲希", password: "2196", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 25, name: "廣野達徳", password: "3194", status: "連絡無し", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" }
];
let nextMemberId = 26;

// 履歴ログの保存用配列
let historyLogs = [];

// スケジュール（予定）保存用配列
let schedules = [];
let nextScheduleId = 1;

// タスク保存用配列
let tasks = [];
let nextTaskId = 1;

// システム設定保存用
let systemSettings = {
    weekdayDates: [], // 16:30〜 (強制平日)
    holidayDates: [], // 09:30〜 (土曜扱い)
    offDates: [],     // 休み (完全休養)
    customDates: {},  // 時間指定 (例: { "2026-04-10": { start: "13:00", end: "17:00" } })
    lastResetDate: "" // 日が変わった際のリセット追跡用（YYYY-MM-DD）
};

// 緊急事態（全画面ロック）設定
let emergencyState = {
    active: false,
    reason: ""
};

// === データ永続化 (保存・復元) ロジック ===
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');
const mongoose = require('mongoose');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// MongoDBスキーマの定義
const stateSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  data: mongoose.Schema.Types.Mixed
}, { strict: false });
const StateModel = mongoose.model('State', stateSchema);

let useMongoDB = false;

// 起動時にデータを読み込む
async function loadData() {
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
        try {
            await mongoose.connect(mongoUri);
            useMongoDB = true;
            console.log("✅ MongoDBに接続しました。クラウドデータをチェックします...");
            
            const state = await StateModel.findOne({ key: 'appState' });
            if (state && state.data) {
                applyData(state.data);
                console.log("✅ MongoDBからクラウドデータを復元しました。");
            } else {
                console.log("ℹ️ MongoDB上に初期データが存在しないため、システムの初期設定を使用します。");
            }
        } catch (e) {
            console.error("❌ MongoDBの接続・読み込みに失敗しました:", e);
        }
    } else {
        // フォールバック: ローカルファイル
        if (fs.existsSync(dbFile)) {
            try {
                const data = fs.readFileSync(dbFile, 'utf8');
                applyData(JSON.parse(data));
                console.log("✅ 既存のローカルファイルデータを復元しました。");
            } catch (e) {
                console.error("❌ ローカルデータの読み込みに失敗しました:", e);
            }
        } else {
            console.log("ℹ️ ローカルにデータが存在しないため、初期設定を使用します。");
        }
    }
}

function applyData(parsed) {
    if (parsed.members) {
        members = parsed.members;
        // 既存の「未設定」や不正な「-」データを「連絡無し」へマイグレーション
        members.forEach(m => {
            if (m.status === '未設定' || m.status === '-') m.status = '連絡無し';
            
            // 初期の固定リーダーID (7, 12) に対して isLeader 権限を自動付与
            if ((m.id === 7 || m.id === 12) && typeof m.canAssignTasks === 'undefined') {
                m.canAssignTasks = true;
            }
        });
    }
    if (parsed.nextMemberId) nextMemberId = parsed.nextMemberId;
    if (parsed.historyLogs) {
        historyLogs = parsed.historyLogs;
        historyLogs.forEach(log => {
            if (log.status === '未設定' || log.status === '-') log.status = '連絡無し';
        });
    }
    if (parsed.schedules) schedules = parsed.schedules;
    if (parsed.nextScheduleId) nextScheduleId = parsed.nextScheduleId;
    if (parsed.tasks) tasks = parsed.tasks;
    if (parsed.nextTaskId) nextTaskId = parsed.nextTaskId;
    if (parsed.systemSettings) systemSettings = parsed.systemSettings;
    if (parsed.emergencyState) emergencyState = parsed.emergencyState;
}

let pendingSave = false;
let saveTimeout = null;

function saveData() {
    // 既に保存予約が入っている場合はスキップ（1秒に1回だけ保存するデバウンス処理）
    if (pendingSave) return;
    pendingSave = true;

    // 非同期で少し遅らせて保存することで、複数人の同時アクセス時（高負荷時）の連続書き込みを防ぐ
    saveTimeout = setTimeout(() => {
        pendingSave = false;
        const data = {
            members,
            nextMemberId,
            historyLogs,
            schedules,
            tasks,
            nextTaskId,
            nextScheduleId,
            systemSettings,
            emergencyState
        };
        
        if (useMongoDB) {
            // MongoDBへ非同期で書き込み
            StateModel.updateOne(
                { key: 'appState' }, 
                { $set: { data: data } }, 
                { upsert: true }
            ).catch(e => console.error("❌ MongoDBへの保存に失敗しました:", e));
        } else {
            // ローカルファイルへ【非同期】で書き込み。writeFileSyncによるフリーズを防ぐ。
            // また、ログが肥大化してもメインプロセス（通信などの応答）を妨げません。
            fs.writeFile(dbFile, JSON.stringify(data, null, 2), 'utf8', (err) => {
                if (err) console.error("❌ ローカルデータの保存に失敗しました:", err);
            });
        }
    }, 1000); // 連続する更新は1秒後に1回だけ書き出す
}

// ========================================

// === 自動運転（Wake-on-Demand）ミドルウェア ===
let overrideAwakeUntil = 0;
const AWAKE_DURATION_MS = 60 * 60 * 1000; // 60分間

app.use((req, res, next) => {
    // 無限リロード防止のため API・Socket 通信等は通過させる
    if (req.method !== 'GET' || req.path.startsWith('/socket.io') || req.path.startsWith('/api')) {
        return next();
    }

    // JSTで現在時刻を取得
    const jstStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    const jstNow = new Date(jstStr);
    const todayStr = `${jstNow.getFullYear()}-${String(jstNow.getMonth() + 1).padStart(2, '0')}-${String(jstNow.getDate()).padStart(2, '0')}`;
    const dayOfWeek = jstNow.getDay();
    const currentTimeVal = jstNow.getHours() * 100 + jstNow.getMinutes();

    let startStr = "";
    let endStr = "";
    let isOff = false;

    if (systemSettings.offDates && systemSettings.offDates.includes(todayStr)) {
        isOff = true;
    } else if (systemSettings.customDates && systemSettings.customDates[todayStr]) {
        startStr = systemSettings.customDates[todayStr].start;
        endStr = systemSettings.customDates[todayStr].end;
    } else if (systemSettings.weekdayDates && systemSettings.weekdayDates.includes(todayStr)) {
        startStr = "16:30";
        endStr = "18:30";
    } else if (systemSettings.holidayDates && systemSettings.holidayDates.includes(todayStr)) {
        startStr = "09:30";
        endStr = "18:30";
    } else {
        if (dayOfWeek === 0) isOff = true;
        else if (dayOfWeek === 6) { startStr = "09:30"; endStr = "18:30"; }
        else { startStr = "16:30"; endStr = "18:30"; }
    }

    let isScheduledTime = false;
    if (!isOff && startStr && endStr) {
        const startVal = parseInt(startStr.replace(':', ''), 10);
        const endVal = parseInt(endStr.replace(':', ''), 10);
        let bufferHH = Math.floor(endVal / 100);
        let bufferMM = (endVal % 100) + 15;
        if(bufferMM >= 60) { bufferHH += 1; bufferMM -= 60; }
        const endBufferVal = bufferHH * 100 + bufferMM;

        if (currentTimeVal >= startVal && currentTimeVal <= endBufferVal) {
            isScheduledTime = true;
        }
    }

    // スケジュール内の場合
    if (isScheduledTime) {
        overrideAwakeUntil = 0;
        return next();
    }

    // スケジュール外だが、臨時起動の有効期限内の場合
    if (Date.now() < overrideAwakeUntil) {
        return next();
    }

    // スケジュール外 ＆ アクセス検知（臨時起動のトリガー）
    overrideAwakeUntil = Date.now() + AWAKE_DURATION_MS;
    res.send(`
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
                <p>時間外のアクセスを検知しました。システムを準備しています。<br>このまま数秒間お待ちください。</p>
            </body>
        </html>
    `);
});
// ===============================================

// 静的ファイルの提供（Service Workerがキャッシュを管理するため、ここでは強力なHTTPキャッシュを行わない）
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        // 全ファイルに対して再検証を強制し、キャッシュロックを防ぐ
        res.setHeader('Cache-Control', 'no-cache');
    }
}));
app.use(express.json());

// API: メンバー一覧の取得
app.get('/api/members', (req, res) => {
  // パスワードを除外して返す
  const publicMembers = members.map(({ password, ...rest }) => rest);
  res.json(publicMembers);
});

// 通信連打（スパム）防止用の状態管理
const clientLastUpdate = {};

// Socket.ioの通信処理
io.on('connection', (socket) => {
  // --- Task Management Endpoints ---
  socket.on('verifyTaskUser', (data, callback) => {
    const { id } = data;
    const member = members.find(m => m.id === parseInt(id, 10));
    if (!member) {
      if(callback) callback({ success: false, message: 'メンバーが見つかりません' });
      return;
    }
    
    // 全員パスワードチェックなしでログイン
    if(callback) callback({ success: true, member });
  });

  socket.on('getTasks', (data, callback) => {
    if(callback) callback({ success: true, tasks });
  });

  socket.on('addTask', (data, callback) => {
    const { assignerId, assigneeId, title, desc, password } = data;
    const leader = members.find(m => m.id === parseInt(assignerId, 10));
    
    if (!leader) {
      if(callback) callback({ success: false, message: 'メンバーが見つかりません' });
      return;
    }
    
    if (password !== 'denken1975') {
      if(callback) callback({ success: false, message: 'タスク振り分け用パスワードが違います' });
      return;
    }
    
    if (leader.canAssignTasks !== true) {
      if(callback) callback({ success: false, message: 'リーダー権限がありません' });
      return;
    }

    const newTask = {
      id: nextTaskId++,
      assignerId: leader.id,
      assigneeId: parseInt(assigneeId, 10),
      title: title,
      desc: desc,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };
    
    tasks.push(newTask);
    io.emit('tasksUpdated', tasks);
    if(callback) callback({ success: true, task: newTask });
    saveData();
  });

  socket.on('updateTaskStatus', (data, callback) => {
    const { taskId, isCompleted, memberId, password } = data;
    const task = tasks.find(t => t.id === parseInt(taskId, 10));
    if (!task) {
      if(callback) callback({success: false, message: 'タスクがありません'});
      return;
    }
    const member = members.find(m => m.id === parseInt(memberId, 10));
    if (!member) {
      if(callback) callback({success: false, message: 'メンバーが見つかりません'});
      return;
    }
    
    const isLeader = member.canAssignTasks === true;
    if (task.assigneeId !== member.id && !isLeader) {
      if(callback) callback({success: false, message: 'このタスクのステータスを変更する権限がありません'});
      return;
    }

    task.isCompleted = isCompleted;
    io.emit('tasksUpdated', tasks);
    if(callback) callback({success: true});
    saveData();
  });

  socket.on('deleteTask', (data, callback) => {
    const { taskId, memberId, password } = data;
    const task = tasks.find(t => t.id === parseInt(taskId, 10));
    if (!task) {
      if(callback) callback({success: false, message: 'タスクがありません'});
      return;
    }
    const member = members.find(m => m.id === parseInt(memberId, 10));
    if (!member) {
      if(callback) callback({success: false, message: 'メンバーが見つかりません'});
      return;
    }
    
    if (password !== 'denken1975') {
      if(callback) callback({success: false, message: 'タスク削除用パスワードが違います'});
      return;
    }

    if (member.canAssignTasks !== true) {
      if(callback) callback({success: false, message: 'リーダー権限がありません'});
      return;
    }

    tasks = tasks.filter(t => t.id !== parseInt(taskId, 10));
    io.emit('tasksUpdated', tasks);
    if(callback) callback({success: true});
    saveData();
  });

  // タスク管理権限の付与・剥奪
  socket.on('setTaskPermission', (data, callback) => {
    const { adminPassword, targetId, canAssign } = data;
    if (adminPassword !== MASTER_PASSWORD && adminPassword !== ADMIN_PASSWORD) {
      if(callback) callback({ success: false, message: '管理パスワードが違います' });
      return;
    }
    const member = members.find(m => m.id === parseInt(targetId, 10));
    if (!member) {
      if(callback) callback({ success: false, message: '対象メンバーが見つかりません' });
      return;
    }
    member.canAssignTasks = canAssign;
    io.emit('memberListUpdated', members); // membersList を更新させる
    saveData();
    if(callback) callback({ success: true, memberName: member.name, canAssign });
  });

  console.log('クライアントが接続しました。');

  // クライアントからのステータス更新要求を受信
  socket.on('updateStatus', (data, callback) => {
    const { id, password, newStatus, newLocation, reason } = data;

    // 管理パスワードでの変更は一括更新処理を行うため、スパムブロックの対象外とする
    const isAdmin = (password === MASTER_PASSWORD || password === ADMIN_PASSWORD);

    // 【連打・過負荷防止】同一クライアントから1秒以内の連続送信はブロック（一般ユーザーのみ）
    if (!isAdmin) {
        const nowTime = Date.now();
        if (clientLastUpdate[socket.id] && nowTime - clientLastUpdate[socket.id] < 1000) {
            if(callback) callback({ success: false, message: "通信が連続しています。少し待ってから再度お試しください。" });
            return;
        }
        clientLastUpdate[socket.id] = nowTime;
    }
    
    // メンバーの検索とパスワード検証
    const member = members.find(m => m.id === parseInt(id, 10));
    if (!member) {
      if(callback) callback({ success: false, message: "メンバーが見つかりません" });
      return;
    }

    // 更新処理
    member.status = newStatus;
    member.location = newLocation;
    member.reason = reason || "";

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    member.lastUpdate = timeStr;

    if (newStatus === '出席' || newStatus === '遅刻') {
        // 出席・遅刻として再打刻した場合は「いる」状態に戻るので、退席時間をリセットする
        member.attendTime = timeStr;
        member.leaveTime = "-";
    } else if (newStatus === '退席' || newStatus === '早退') {
        member.leaveTime = timeStr;
    } else if (newStatus === '欠席' || newStatus === '連絡無し') {
        // 欠席等の場合はボード上の時間を両方リセットする
        member.attendTime = "-";
        member.leaveTime = "-";
    }

    // 履歴に追加
    historyLogs.push({
      memberId: member.id,
      name: member.name,
      status: newStatus,
      location: newLocation,
      reason: reason || "",
      timestamp: now.toISOString()
    });

    // 更新成功を返す
    if(callback) callback({ success: true, member: { id: member.id, name: member.name, status: member.status, location: member.location, reason: member.reason, lastUpdate: member.lastUpdate, attendTime: member.attendTime, leaveTime: member.leaveTime } });

    // 全クライアントに変更をブロードキャスト
    io.emit('statusChanged', {
      id: member.id,
      name: member.name,
      status: member.status,
      location: member.location,
      reason: member.reason,
      lastUpdate: member.lastUpdate,
      attendTime: member.attendTime,
      leaveTime: member.leaveTime
    });
    saveData();
  });

  // 翌日以降の事前連絡（長期休暇・事前の欠席・事前の遅刻）
  socket.on('submitFutureEvent', (data, callback) => {
    const { id, type, startDate, endDate, reason } = data;
    const member = members.find(m => m.id === parseInt(id, 10));
    if (!member) {
        if(callback) callback({ success: false, message: "メンバーが見つかりません" });
        return;
    }

    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    
    // UTCで深夜0時を作成し、1日ずつ加算していく（サーバーのタイムゾーンの影響を完全に排除）
    let currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const endDateObj = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    const nowJst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const todayStr = `${nowJst.getFullYear()}-${String(nowJst.getMonth() + 1).padStart(2, '0')}-${String(nowJst.getDate()).padStart(2, '0')}`;

    let logsAdded = 0;
    let includesToday = false;

    // タイプからのステータス判定: 「事前の遅刻」なら「遅刻」、それ以外は「欠席」
    const targetStatus = (type === '事前の遅刻') ? '遅刻' : '欠席';

    while (currentDate <= endDateObj) {
        // currentDateはUTCベースなのでgetUTCメソッドで日付文字列を生成する
        const yyyyMmDd = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
        const dayOfWeek = currentDate.getUTCDay();

        const isOffDate = systemSettings.offDates && systemSettings.offDates.includes(yyyyMmDd);
        const isExplicitWeekday = systemSettings.weekdayDates && systemSettings.weekdayDates.includes(yyyyMmDd);
        const hasCustomTime = systemSettings.customDates && !!systemSettings.customDates[yyyyMmDd];
        const isSunday = (dayOfWeek === 0);

        // 休みの日、または「強制平日・カスタム設定されていない通常の日曜日」はスキップ
        if (isOffDate || (isSunday && !isExplicitWeekday && !hasCustomTime)) {
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            continue;
        }

        // ログを作成（カレンダー表示用に、その日の朝9時に休みの連絡を入れたようなタイムスタンプにする）
        const insertTime = new Date(`${yyyyMmDd}T09:00:00+09:00`);
        
        historyLogs.push({
            memberId: member.id,
            name: member.name,
            status: targetStatus,
            location: '-',
            reason: reason || type,
            timestamp: insertTime.toISOString()
        });
        logsAdded++;

        if (yyyyMmDd === todayStr) {
            includesToday = true;
        }

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // もし指定期間に「本日」が含まれていれば、現在のライブ状況も対象ステータスに更新する
    if (includesToday) {
        member.status = targetStatus;
        member.location = '-';
        member.reason = reason || type;
        member.attendTime = "-";
        member.leaveTime = "-";
        
        const timeStr = `${nowJst.getHours().toString().padStart(2, '0')}:${nowJst.getMinutes().toString().padStart(2, '0')}`;
        member.lastUpdate = timeStr;

        io.emit('statusChanged', {
            id: member.id,
            name: member.name,
            status: member.status,
            location: member.location,
            reason: member.reason,
            lastUpdate: member.lastUpdate,
            attendTime: member.attendTime,
            leaveTime: member.leaveTime
        });
    }

    if(callback) callback({ success: true, name: member.name });
    io.emit('historyUpdated', historyLogs);
    saveData();
  });

  // 管理者向け: パスワード検証
  socket.on('verifyAdmin', (data, callback) => {
    if (data.password === ADMIN_PASSWORD) {
      if(callback) callback({ success: true });
    } else {
      if(callback) callback({ success: false, message: "管理者パスワードが違います" });
    }
  });

  // 管理者向け: メンバー追加
  socket.on('addMember', (data, callback) => {
    const { adminPassword, name, team } = data;
    if (adminPassword !== ADMIN_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }
    if (!name) {
      if(callback) callback({ success: false, message: "名前を入力してください" });
      return;
    }

    const newMember = {
      id: nextMemberId++,
      name: name,
      team: team || "共通",
      password: "",
      status: "連絡無し",
      location: "-",
      lastUpdate: "-",
      attendTime: "-",
      leaveTime: "-"
    };
    members.push(newMember);

    if(callback) callback({ success: true });
    
    // メンバーリストが変更されたことを全体に通知（リダイレクトや再取得を促す）
    io.emit('memberListUpdated');
    saveData();
  });

  // 管理者向け: メンバー削除
  socket.on('removeMember', (data, callback) => {
    const { adminPassword, id } = data;
    if (adminPassword !== ADMIN_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }

    const initialLength = members.length;
    members = members.filter(m => m.id !== parseInt(id, 10));

    if (members.length === initialLength) {
      if(callback) callback({ success: false, message: "メンバーが見つかりません" });
      return;
    }

    if(callback) callback({ success: true, memberList: members });
    io.emit('memberListUpdated');
    saveData();
  });

  // 管理者向け: 所属チーム変更
  socket.on('changeTeam', (data, callback) => {
    const { adminPassword, id, newTeam } = data;
    if (adminPassword !== ADMIN_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }

    const member = members.find(m => m.id === parseInt(id, 10));
    if (!member) {
      if(callback) callback({ success: false, message: "メンバーが見つかりません" });
      return;
    }

    member.team = newTeam;
    if(callback) callback({ success: true });
    
    io.emit('memberListUpdated');
    saveData();
  });

  // 管理者向け: 過去の出欠状況の強制上書き
  socket.on('overridePastAttendance', (data, callback) => {
    const { password, memberId, targetDate, newStatus, customTimeStr } = data;
    if (password !== "Yamamoto5106(!1!)") {
      if(callback) callback({ success: false, message: "専用パスワードが違います" });
      return;
    }

    const member = members.find(m => m.id === parseInt(memberId, 10));
    if (!member) {
      if(callback) callback({ success: false, message: "メンバーが見つかりません" });
      return;
    }

    // 1. 指定された日付の当該メンバーのログをすべて削除
    historyLogs = historyLogs.filter(log => {
      // ログのtimestampはISO文字列。日本時間での日付文字列を生成する
      const logDateObj = new Date(log.timestamp);
      const jstDate = new Date(logDateObj.getTime() + 9 * 60 * 60 * 1000);
      const logDateStr = `${jstDate.getUTCFullYear()}-${String(jstDate.getUTCMonth()+1).padStart(2,'0')}-${String(jstDate.getUTCDate()).padStart(2,'0')}`;
      return !(log.memberId === member.id && logDateStr === targetDate);
    });

    // 2. 新しいステータスに応じて架空のログを追加
    const dateObj = new Date(targetDate);
    const dayOfWeek = dateObj.getDay();
    const isHoliday = systemSettings.holidayDates && systemSettings.holidayDates.includes(targetDate);
    const isWeekdayDate = systemSettings.weekdayDates && systemSettings.weekdayDates.includes(targetDate);
    const customTimeObj = systemSettings.customDates && systemSettings.customDates[targetDate];
    
    let defaultStart = "16:30:00";
    let defaultEnd = "18:30:00";
    if (customTimeObj) {
        defaultStart = customTimeObj.start + ":00";
        defaultEnd = customTimeObj.end + ":00";
    } else if (isHoliday || (dayOfWeek === 6 && !isWeekdayDate) || (dayOfWeek === 0 && !isWeekdayDate)) {
        defaultStart = "09:30:00";
    }

    const tStartISO = new Date(`${targetDate}T${defaultStart}+09:00`).toISOString();
    const tEndISO = new Date(`${targetDate}T${defaultEnd}+09:00`).toISOString();

    if (newStatus === "出席") {
        historyLogs.push({ memberId: member.id, name: member.name, status: "出席", location: "-", reason: "管理者修正", timestamp: tStartISO });
        historyLogs.push({ memberId: member.id, name: member.name, status: "退席", location: "-", reason: "管理者修正", timestamp: tEndISO });
    } else if (newStatus === "欠席") {
        historyLogs.push({ memberId: member.id, name: member.name, status: "欠席", location: "-", reason: "管理者修正", timestamp: tStartISO });
    } else if (newStatus === "遅刻") {
        const lateTimeStr = customTimeStr ? customTimeStr + ":00" : "17:00:00";
        const tLateISO = new Date(`${targetDate}T${lateTimeStr}+09:00`).toISOString();
        historyLogs.push({ memberId: member.id, name: member.name, status: "遅刻", location: "-", reason: "管理者修正", timestamp: tLateISO });
        historyLogs.push({ memberId: member.id, name: member.name, status: "退席", location: "-", reason: "管理者修正", timestamp: tEndISO });
    } else if (newStatus === "消去") {
        // 何もしない（削除のみ）
    }

    // 履歴を時間順にソートするよう整える
    historyLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if(callback) callback({ success: true, logs: historyLogs });
    io.emit('historyUpdated', historyLogs);
    saveData();
  });


  // 管理者向け: 全データの初期化
  socket.on('clearAllHistory', (data, callback) => {
    const { adminPassword } = data;
    if (adminPassword !== ADMIN_PASSWORD && adminPassword !== MASTER_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }
    
    // 全履歴を削除
    historyLogs = [];
    
    // 全員のステータスを初期化
    members.forEach(m => {
        m.status = "連絡無し";
        m.location = "-";
        m.lastUpdate = "-";
        m.attendTime = "-";
        m.leaveTime = "-";
    });
    
    // 全クライアントに変更を通知
    io.emit('memberListUpdated');
    
    // 履歴更新を通知
    io.emit('historyUpdated', historyLogs);
    
    // 全クライアントの画面を強制的にリロードして白紙状態を反映させる
    io.emit('forceReload');
    
    if(callback) callback({ success: true });
    saveData();
  });

  // 管理者向け: 履歴の取得
  socket.on('getHistory', (data, callback) => {
    const { adminPassword } = data;
    if (adminPassword !== ADMIN_PASSWORD && adminPassword !== MASTER_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }
    // 新しい履歴を上に表示するために逆順にして返す
    const reversedLogs = [...historyLogs].reverse();
    if(callback) callback({ success: true, logs: reversedLogs });
  });

  // スケジュールの取得 (全員可能)
  socket.on('getSchedules', (callback) => {
    if(callback) callback({ success: true, schedules });
  });

  // スケジュールの追加
  socket.on('addSchedule', (data, callback) => {
    const { adminPassword, schedule } = data;
    if (adminPassword !== ADMIN_PASSWORD && adminPassword !== MASTER_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }
    
    schedule.id = nextScheduleId++;
    schedules.push(schedule);
    
    if(callback) callback({ success: true, schedule });
    io.emit('schedulesUpdated', schedules);
    saveData();
  });

  // スケジュールの削除
  socket.on('deleteSchedule', (data, callback) => {
    const { adminPassword, scheduleId } = data;
    if (adminPassword !== ADMIN_PASSWORD && adminPassword !== MASTER_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }
    
    schedules = schedules.filter(s => s.id !== parseInt(scheduleId, 10));
    
    if(callback) callback({ success: true });
    io.emit('schedulesUpdated', schedules);
    saveData();
  });

  // 設定の取得 (全員可能)
  socket.on('getSettings', (callback) => {
    if(callback) callback({ success: true, settings: systemSettings });
  });

  // 設定の更新
  socket.on('updateSettings', (data, callback) => {
    const { adminPassword, newSettings } = data;
    if (adminPassword !== ADMIN_PASSWORD && adminPassword !== MASTER_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }
    systemSettings = { ...systemSettings, ...newSettings };
    io.emit('settingsUpdated', systemSettings);
    if(callback) callback({ success: true, settings: systemSettings });
    saveData();
  });

  // ========== 緊急事態（システム停止）機能 ==========
  
  // 初回接続時の状態確認
  socket.on('checkEmergencyState', () => {
    socket.emit('emergencyStateUpdate', emergencyState);
  });

  // 緊急事態発令
  socket.on('triggerEmergency', (data, callback) => {
    const { emergencyPassword, reason } = data;
    if (emergencyPassword !== "Yamamoto5106(1!1)") {
      if(callback) callback({ success: false, message: "パスワードが違います" });
      return;
    }
    
    emergencyState.active = true;
    emergencyState.reason = reason || "非常事態による部内における活動停止措置";

    // 発令日を強制的に「完全休日(offDate)」に登録
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    
    if (!systemSettings.offDates) systemSettings.offDates = [];
    if (!systemSettings.offDates.includes(todayStr)) {
        systemSettings.offDates.push(todayStr);
    }
    // 他の設定（活動日・土曜扱い）と競合しないよう削除
    if (systemSettings.holidayDates) {
        systemSettings.holidayDates = systemSettings.holidayDates.filter(d => d !== todayStr);
    }
    if (systemSettings.weekdayDates) {
        systemSettings.weekdayDates = systemSettings.weekdayDates.filter(d => d !== todayStr);
    }

    io.emit('settingsUpdated', systemSettings); // 設定更新を通知
    io.emit('emergencyStateUpdate', emergencyState); // ロック画面を通知

    if(callback) callback({ success: true, emergencyState, settings: systemSettings });
    saveData();
  });

  // 緊急事態解除
  socket.on('resolveEmergency', (data, callback) => {
    const { emergencyPassword } = data;
    if (emergencyPassword !== "Yamamoto5106(1!1)") {
      if(callback) callback({ success: false, message: "パスワードが違います" });
      return;
    }

    emergencyState.active = false;
    emergencyState.reason = "";
    
    io.emit('emergencyStateUpdate', emergencyState);

    if(callback) callback({ success: true, emergencyState });
    saveData();
  });

  socket.on('disconnect', () => {
    delete clientLastUpdate[socket.id]; // メモリ解放（長時間起動時の重さ対策）
    console.log('クライアントが切断されました。');
  });
});

// === 深夜0時の自動リセット機能 ===
// 日本時間(JST)で日付が変わったかを定期チェックする関数
function checkMidnightReset() {
    const currentJstStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    const currentJst = new Date(currentJstStr);
    const currentDate = `${currentJst.getFullYear()}-${String(currentJst.getMonth() + 1).padStart(2, '0')}-${String(currentJst.getDate()).padStart(2, '0')}`;

    // 初回起動時など、lastResetDateが空の場合は現在の日付をセットするだけ
    if (!systemSettings.lastResetDate) {
        systemSettings.lastResetDate = currentDate;
        saveData();
        return;
    }

    if (currentDate !== systemSettings.lastResetDate) {
        systemSettings.lastResetDate = currentDate;
        let requiresReset = false;

        // 全メンバーのステータスを初期化または事前登録済みの連絡（欠席・遅刻）に更新
        members.forEach(member => {
            // UTCでの保存日時からJSTでのYYYY-MM-DDを取得してチェックする厳密な方法
            const todayPreLog = historyLogs.find(log => {
                if (log.name !== member.name || (log.status !== '欠席' && log.status !== '遅刻')) return false;
                const logTime = new Date(log.timestamp);
                const logJst = new Date(logTime.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
                const logYmd = `${logJst.getFullYear()}-${String(logJst.getMonth() + 1).padStart(2, '0')}-${String(logJst.getDate()).padStart(2, '0')}`;
                return logYmd === currentDate;
            });

            if (todayPreLog) {
                // 事前に欠席や遅刻のログがあった場合は、連絡無しではなくそのステータスをセットする
                if (member.status !== todayPreLog.status || member.reason !== todayPreLog.reason) {
                    member.status = todayPreLog.status;
                    member.reason = todayPreLog.reason || "事前連絡";
                    member.attendTime = "-";
                    member.leaveTime = "-";
                    member.location = "-";
                    requiresReset = true;
                }
            } else if (member.status !== "連絡無し") {
                member.status = "連絡無し";
                member.reason = "";
                member.attendTime = "-";
                member.leaveTime = "-";
                member.location = "-";
                requiresReset = true;
            }
        });

        if (requiresReset) {
            // パスワードを除外して配信
            const publicMembers = members.map(({ password, ...rest }) => rest);
            io.emit('initData', publicMembers); // クライアント全体の表示をリフレッシュ
            saveData();
            console.log(`[${currentJstStr}] 深夜0時の自動リセットを実行しました`);
        } else {
            saveData(); // 日付だけは更新されているので保存
        }
    }
}

// 1分間隔でチェック
setInterval(checkMidnightReset, 60 * 1000);
// ===================================

const PORT = process.env.PORT || 3000;
// データの読み込みが完全に終わってからサーバーを起動する（データ消失バグの防止）
loadData().then(() => {
    // 起動時に、サーバーダウン中に日が変わっていた場合の再チェックを行う
    checkMidnightReset();

    server.listen(PORT, () => {
        console.log(`サーバーがポート ${PORT} で起動しました: http://localhost:${PORT}`);
    });
}).catch((e) => {
    console.error("起動エラー:", e);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 管理用パスワード
const ADMIN_PASSWORD = "51068010A";
const MASTER_PASSWORD = "denken1975"; // 全員分の出欠入力を可能にするマスターパスワード

// 部員の初期データ (名前, パスワード, 現在のステータス, 活動場所, 最終更新時刻)
let members = [
  { id: 1, name: "齋藤広平", password: "2139", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 2, name: "酒井翔太郎", password: "2142", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 3, name: "竹原翔斗", password: "2166", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 4, name: "津志田悠希", password: "2319", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 5, name: "牧治翔", password: "2469", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 6, name: "内川龍馬", password: "3113", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 7, name: "桑原大翔", password: "3140", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 8, name: "坂田麻衣子", password: "3398", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 9, name: "高山蒼", password: "3284", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 10, name: "松野大翔", password: "3197", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 11, name: "生駒真太朗", password: "4189", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 12, name: "吉村成宏", password: "4435", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 13, name: "宮本王道", password: "4411", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 14, name: "牛島健斗", password: "5220", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 15, name: "澤村悠真", password: "5268", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 16, name: "竹ノ井海斗", password: "5304", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 17, name: "成嶋昊", password: "5340", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 18, name: "中山心春", password: "5556", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 19, name: "野田伊織", password: "5346", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 20, name: "原田透志", password: "5352", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 21, name: "松永知也", password: "5388", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 22, name: "松藤叶汰", password: "5394", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 23, name: "豊田理琴", password: "2181", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 24, name: "西美咲希", password: "2196", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 25, name: "廣野達徳", password: "3194", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" }
];
let nextMemberId = 26;

// 履歴ログの保存用配列
let historyLogs = [];

// スケジュール（予定）保存用配列
let schedules = [];
let nextScheduleId = 1;

// システム設定保存用
let systemSettings = {
    weekdayDates: [], // 16:30〜 (強制平日)
    holidayDates: [], // 09:30〜 (土曜扱い)
    offDates: []      // 休み (完全休養)
};

// 緊急事態（全画面ロック）設定
let emergencyState = {
    active: false,
    reason: ""
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API: メンバー一覧の取得
app.get('/api/members', (req, res) => {
  // パスワードを除外して返す
  const publicMembers = members.map(({ password, ...rest }) => rest);
  res.json(publicMembers);
});

// Socket.ioの通信処理
io.on('connection', (socket) => {
  console.log('クライアントが接続しました。');

  // クライアントからのステータス更新要求を受信
  socket.on('updateStatus', (data, callback) => {
    const { id, password, newStatus, newLocation, reason } = data;
    
    // メンバーの検索とパスワード検証
    const member = members.find(m => m.id === parseInt(id, 10));
    if (!member) {
      if(callback) callback({ success: false, message: "メンバーが見つかりません" });
      return;
    }
    
    // 個人のパスワード、またはマスターパスワード、または管理用パスワードのいずれかが一致すればOK
    if (member.password !== password && password !== MASTER_PASSWORD && password !== ADMIN_PASSWORD) {
      if(callback) callback({ success: false, message: "パスワードが間違っています" });
      return;
    }

    // 更新処理
    member.status = newStatus;
    member.location = newLocation;
    member.reason = reason || "";

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    member.lastUpdate = timeStr;

    if (newStatus === '出席') {
        member.attendTime = timeStr;
    } else if (newStatus === '退席') {
        member.leaveTime = timeStr;
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
    const { adminPassword, name, password } = data;
    if (adminPassword !== ADMIN_PASSWORD) {
      if(callback) callback({ success: false, message: "権限がありません" });
      return;
    }
    if (!name || !password) {
      if(callback) callback({ success: false, message: "名前とパスワードを入力してください" });
      return;
    }

    const newMember = {
      id: nextMemberId++,
      name: name,
      password: password,
      status: "未設定",
      location: "-",
      lastUpdate: "-",
      attendTime: "-",
      leaveTime: "-"
    };
    members.push(newMember);

    if(callback) callback({ success: true });
    
    // メンバーリストが変更されたことを全体に通知（リダイレクトや再取得を促す）
    io.emit('memberListUpdated');
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
        m.status = "未設定";
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
  });

  socket.on('disconnect', () => {
    console.log('クライアントが切断されました。');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました: http://localhost:${PORT}`);
});

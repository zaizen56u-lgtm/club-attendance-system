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
const MASTER_PASSWORD = "51068010A"; // 全員分の出欠入力を可能にするマスターパスワード

// 部員の初期データ (名前, パスワード, 現在のステータス, 活動場所, 最終更新時刻)
let members = [
  { id: 1, name: "山田 太郎", password: "0000", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 2, name: "佐藤 花子", password: "1111", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" },
  { id: 3, name: "鈴木 一郎", password: "2222", status: "未設定", location: "-", lastUpdate: "-", attendTime: "-", leaveTime: "-" }
];
let nextMemberId = 4;

// 履歴ログの保存用配列
let historyLogs = [];

// スケジュール（予定）保存用配列
let schedules = [];
let nextScheduleId = 1;

// システム設定保存用
let systemSettings = {
    holidayDates: [] // 例: ['2026-03-20', '2026-04-05']
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
    const { id, password, newStatus, newLocation } = data;
    
    // メンバーの検索とパスワード検証
    const member = members.find(m => m.id === parseInt(id, 10));
    if (!member) {
      if(callback) callback({ success: false, message: "メンバーが見つかりません" });
      return;
    }
    
    if (member.password !== password && password !== MASTER_PASSWORD) {
      if(callback) callback({ success: false, message: "パスワードが間違っています" });
      return;
    }

    // 更新処理
    member.status = newStatus;
    member.location = newLocation;
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
      timestamp: now.toISOString()
    });

    // 更新成功を返す
    if(callback) callback({ success: true, member: { id: member.id, name: member.name, status: member.status, location: member.location, lastUpdate: member.lastUpdate } });

    // 全クライアントに変更をブロードキャスト
    io.emit('statusChanged', {
      id: member.id,
      name: member.name,
      status: member.status,
      location: member.location,
      lastUpdate: member.lastUpdate
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
      lastUpdate: "-"
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

    if(callback) callback({ success: true });
    
    // 全体に通知
    io.emit('memberListUpdated');
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

  socket.on('disconnect', () => {
    console.log('クライアントが切断されました。');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました: http://localhost:${PORT}`);
});

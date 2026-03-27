document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const alertBox = document.getElementById('alert-box');
    const userFilter = document.getElementById('user-filter');

    let allLogs = [];
    let calendar;
    let systemSettings = { holidayDates: [] };

    function applyDynamicColors(settings) {
        let styleEl = document.getElementById('dynamic-calendar-style');
        if(!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-calendar-style';
            document.head.appendChild(styleEl);
        }
        let css = '';
        if (settings.holidayDates) {
            settings.holidayDates.forEach(dateStr => {
                css += `
                .fc-day[data-date="${dateStr}"] { background-color: rgba(239, 68, 68, 0.05) !important; }
                .fc-day[data-date="${dateStr}"] .fc-col-header-cell-cushion, 
                .fc-day[data-date="${dateStr}"] .fc-daygrid-day-number { color: #EF4444 !important; }`;
            });
        }
        styleEl.innerHTML = css;
    }

    // FullCalendarの初期化
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        height: 'auto',
        slotMinTime: '06:00:00',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: '今日',
            month: '月',
            week: '週',
            day: '日'
        },
        dateClick: function(info) {
            calculateDailyStats(info.dateStr);
        },
        events: []
    });
    calendar.render();

    // メンバーリストの読み込み(フィルター用)
    fetch('/api/members')
        .then(res => res.json())
        .then(members => {
            members.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = m.name;
                userFilter.appendChild(opt);
            });
            // メンバーリスト取得後に履歴も自動で取得する
            loadHistory();
        });

    function loadHistory() {
        const adminPassword = "51068010A"; // JSファイル内でパスワードを自動付与して取得

        socket.emit('getSettings', (setRes) => {
            if (setRes.success) {
                systemSettings = setRes.settings;
                applyDynamicColors(systemSettings);
            }
            socket.emit('getHistory', { adminPassword }, (res) => {
                if (res.success) {
                    allLogs = res.logs;
                    renderCalendar();
                } else {
                    showAlert('エラー', res.message, 'error');
                }
            });
        });
    }

    socket.on('settingsUpdated', (newSettings) => {
        systemSettings = newSettings;
        applyDynamicColors(systemSettings);
        if (allLogs.length > 0) renderCalendar();
    });

    function renderCalendar() {
        const selectedUser = userFilter.value;

        // 全員表示オプションは廃止されたため、未選択時はカレンダーを空にする
        if (!selectedUser || selectedUser === 'none') {
            calendar.removeAllEventSources();
            document.getElementById('stats-panel').style.display = 'none';
            return;
        }

        // ユーザー名でフィルタリング
        const filtered = allLogs.filter(log => log.name === selectedUser);

        // 日付・ユーザーごとに最初の「出席」と最後の「退席」を抽出
        const dailyRecords = {};

        filtered.forEach(log => {
            const dateObj = new Date(log.timestamp);
            const yyyyMmDd = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
            const key = `${log.name}_${yyyyMmDd}`;
            
            if (!dailyRecords[key]) {
                dailyRecords[key] = {
                    name: log.name,
                    date: yyyyMmDd,
                    firstAttendTime: null,
                    firstAttendRaw: null,
                    lastLeaveTime: null,
                    lastLeaveRaw: null,
                    attended: false
                };
            }

            const timeStr = `${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;
            const rawTime = dateObj.getTime();

            if (log.status === '出席') {
                dailyRecords[key].attended = true;
                if (!dailyRecords[key].firstAttendRaw || rawTime < dailyRecords[key].firstAttendRaw) {
                    dailyRecords[key].firstAttendTime = timeStr;
                    dailyRecords[key].firstAttendRaw = rawTime;
                }
            } else if (log.status === '退席' || log.status === '早退') {
                if (!dailyRecords[key].lastLeaveRaw || rawTime > dailyRecords[key].lastLeaveRaw) {
                    dailyRecords[key].lastLeaveTime = timeStr;
                    dailyRecords[key].lastLeaveRaw = rawTime;
                }
            }
        });

        // カレンダー用のイベントデータに変換
        const events = Object.values(dailyRecords).map(record => {
            const titlePrefix = selectedUser ? '' : `[${record.name}] `;
            
            if (!record.attended) {
                return {
                    title: `${titlePrefix}出席記録なし`,
                    start: record.date,
                    color: '#9CA3AF',
                    allDay: true
                };
            } else {
                let timeText = `出席 ${record.firstAttendTime}`;
                let endIso = null;

                // もし退席していればその時間を終了点にし、していなければ現在時刻を終了点にする
                if (record.lastLeaveTime) {
                    timeText += ` 〜 退席 ${record.lastLeaveTime}`;
                    endIso = new Date(record.lastLeaveRaw).toISOString();
                } else {
                    timeText += ` 〜 (活動中)`;
                    endIso = new Date().toISOString();
                }
                
                return {
                    title: `${titlePrefix}${timeText}`,
                    start: new Date(record.firstAttendRaw).toISOString(),
                    end: endIso,
                    color: '#4F46E5', // メインカラー（紫・青系）にして目立たせる
                    allDay: false // falseにすることで日・週ビューで時間帯のブロックとして描画される
                };
            }
        });

        // カレンダーのイベントを更新
        calendar.removeAllEventSources();
        calendar.addEventSource(events);

        // --- 統計パネルの計算・更新処理 ---
        calculateStats(selectedUser, dailyRecords, allLogs);
    }

    function calculateStats(selectedUser, dailyRecords, allLogs) {
        if (!selectedUser || allLogs.length === 0) {
            document.getElementById('stats-panel').style.display = 'none';
            return;
        }

        const timestamps = allLogs.map(l => new Date(l.timestamp).getTime());
        const minTime = Math.min(...timestamps);
        let currentDate = new Date(minTime);
        currentDate.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);

        let attendDays = 0;
        let absentDays = 0;
        let holidayDays = 0;
        let holidayTimeMs = 0;
        let lateCount = 0;
        let lateTimeMs = 0;
        let earlyCount = 0;
        let earlyTimeMs = 0;
        let overtimeCount = 0;
        let overtimeTimeMs = 0;

        while (currentDate <= today) {
            const yyyyMmDd = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;
            const dayOfWeek = currentDate.getDay(); // 0: Sun, 1-5: Weekday, 6: Sat
            const key = `${selectedUser}_${yyyyMmDd}`;
            const record = dailyRecords[key];

            const hasAttended = record && record.attended;
            const isHoliday = systemSettings.holidayDates && systemSettings.holidayDates.includes(yyyyMmDd);

            if (hasAttended) {
                attendDays++;
                
                const firstAttendObj = new Date(record.firstAttendRaw);
                const lastLeaveObj = record.lastLeaveRaw ? new Date(record.lastLeaveRaw) : null;

                if (isHoliday) { // 休日設定されている曜日
                    holidayDays++;
                    if (lastLeaveObj) {
                        holidayTimeMs += (lastLeaveObj.getTime() - firstAttendObj.getTime());
                    }
                } else {
                    const reqStart = new Date(currentDate);
                    const reqEnd = new Date(currentDate);
                    
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // 月〜金
                        reqStart.setHours(16, 30, 0, 0);
                        reqEnd.setHours(18, 30, 0, 0);
                    } else if (dayOfWeek === 6 || dayOfWeek === 0) { // 設定外の土日は9:30-18:30を標準の活動時間とみなす
                        reqStart.setHours(9, 30, 0, 0);
                        reqEnd.setHours(18, 30, 0, 0);
                    }

                    // 遅刻の判定
                    if (firstAttendObj > reqStart) {
                        lateCount++;
                        lateTimeMs += (firstAttendObj.getTime() - reqStart.getTime());
                    }

                    // 早退の判定 (終了時間より前に帰ったか)
                    if (lastLeaveObj && lastLeaveObj < reqEnd) {
                        earlyCount++;
                        earlyTimeMs += (reqEnd.getTime() - lastLeaveObj.getTime());
                    }

                    // 時間外(残業・早朝等)の判定: 実際の活動時間から規定時間内の被りを引いたもの
                    if (lastLeaveObj) {
                        const totalMs = lastLeaveObj.getTime() - firstAttendObj.getTime();
                        if (totalMs > 0) {
                            const overlapStart = Math.max(firstAttendObj.getTime(), reqStart.getTime());
                            const overlapEnd = Math.min(lastLeaveObj.getTime(), reqEnd.getTime());
                            const overlap = Math.max(0, overlapEnd - overlapStart);
                            
                            const outsideTime = totalMs - overlap;
                            // 規定時間外の活動があった（早朝または残業のどちらかに数分でもはみ出した）
                            if (outsideTime > 0) {
                                overtimeCount++;
                                overtimeTimeMs += outsideTime;
                            }
                        }
                    }
                }
            } else {
                if (!isHoliday) { // 休日でない場合は必須日なので欠席
                    absentDays++;
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const msToHm = (ms) => {
            const totalMins = Math.floor(ms / (1000 * 60));
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            return `${h}時間${m}分`;
        };

        document.getElementById('stats-attend').innerText = `${attendDays} 日`;
        document.getElementById('stats-absent').innerText = `${absentDays} 日`;
        document.getElementById('stats-holiday-count').innerText = `${holidayDays} 日`;
        document.getElementById('stats-late-count').innerText = `${lateCount} 回`;
        document.getElementById('stats-late-time').innerText = `(${msToHm(lateTimeMs)})`;
        document.getElementById('stats-early-count').innerText = `${earlyCount} 回`;
        document.getElementById('stats-early-time').innerText = `(${msToHm(earlyTimeMs)})`;
        document.getElementById('stats-overtime-count').innerText = `${overtimeCount} 回`;
        document.getElementById('stats-overtime-time').innerText = `(${msToHm(overtimeTimeMs)})`;

        document.getElementById('stats-panel').style.display = 'block';
    }

    function calculateDailyStats(dateStr) {
        const dayLogs = allLogs.filter(log => {
            const d = new Date(log.timestamp);
            const logDateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            return logDateStr === dateStr;
        });

        const memberStats = {};
        const memberNames = Array.from(userFilter.options)
            .filter(opt => opt.value !== 'none')
            .map(opt => opt.value);
            
        memberNames.forEach(name => {
            memberStats[name] = { 
                finalStatus: '未設定', 
                attended: false, 
                firstAttendTime: null, 
                lastLeaveTime: null 
            };
        });

        dayLogs.forEach(log => {
            if (!memberStats[log.name]) return;
            const ms = memberStats[log.name];
            ms.finalStatus = log.status;
            
            const logTime = new Date(log.timestamp).getTime();

            if (log.status === '出席') {
                ms.attended = true;
                if (!ms.firstAttendTime || logTime < ms.firstAttendTime) ms.firstAttendTime = logTime;
            } else if (log.status === '退席' || log.status === '早退') {
                if (!ms.lastLeaveTime || logTime > ms.lastLeaveTime) ms.lastLeaveTime = logTime;
            }
        });

        let attendCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let earlyCount = 0;
        let otherCount = 0;

        const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;
        const actualStart = new Date(`${dateStr}T${isWeekend ? '09:30:00' : '16:30:00'}`).getTime();
        const actualEnd = new Date(`${dateStr}T18:30:00`).getTime();
        const isHoliday = systemSettings.holidayDates && systemSettings.holidayDates.includes(dateStr);

        Object.values(memberStats).forEach(ms => {
            if (ms.attended) {
                attendCount++;
                if (ms.firstAttendTime > actualStart) lateCount++;
                if (ms.lastLeaveTime && ms.lastLeaveTime < actualEnd) earlyCount++;
            } else {
                if (!isHoliday && ms.finalStatus === '未設定') absentCount++;
                else if (ms.finalStatus === '欠席') absentCount++;
                else otherCount++;
            }
        });

        document.getElementById('daily-date-label').textContent = dateStr;
        document.getElementById('daily-attend-count').textContent = `${attendCount} 人`;
        document.getElementById('daily-absent-count').textContent = `${absentCount} 人`;
        document.getElementById('daily-late-count').textContent = `${lateCount} 人`;
        document.getElementById('daily-early-count').textContent = `${earlyCount} 人`;
        document.getElementById('daily-other-count').textContent = `${otherCount} 人`;

        document.getElementById('daily-summary-panel').style.display = 'block';
    }

    // ユーザーが変更されたらカレンダーを再描画
    userFilter.addEventListener('change', renderCalendar);

    function showAlert(title, message, type) {
        alertBox.textContent = `[${title}] ${message}`;
        alertBox.className = `alert ${type}`;
        alertBox.classList.remove('hidden');
        setTimeout(() => {
            alertBox.classList.add('hidden');
        }, 5000);
    }
});

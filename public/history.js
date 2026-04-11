document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // サーバーからの強制リロード命令
    socket.on('forceReload', () => {
        window.location.reload();
    });

    const alertBox = document.getElementById('alert-box');
    const userFilter = document.getElementById('user-filter');

    let allLogs = [];
    let calendar;
    let systemSettings = { weekdayDates: [], holidayDates: [], offDates: [], customDates: {} };

    function applyDynamicColors(settings) {
        // 色分けは廃止したため、カレンダーのスタイル操作は行わない
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

        // ユーザー名でフィルタリングし、確実に時系列順にソートする
        const filtered = allLogs.filter(log => log.name === selectedUser);
        filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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
                    attended: false,
                    excusedLate: false,
                    excusedAbsent: false
                };
            }

            const timeStr = `${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;
            const rawTime = dateObj.getTime();

            if (log.status === '出席' || log.status === '遅刻') {
                dailyRecords[key].attended = true;
                if (!dailyRecords[key].firstAttendRaw || rawTime < dailyRecords[key].firstAttendRaw) {
                    dailyRecords[key].firstAttendTime = timeStr;
                    dailyRecords[key].firstAttendRaw = rawTime;
                }
                // 再出席した場合は直前の退席は無効（まだ帰っていない状態）
                dailyRecords[key].lastLeaveTime = null;
                dailyRecords[key].lastLeaveRaw = null;
            } else if (log.status === '退席' || log.status === '早退') {
                // 退席は常に上書き（時系列ソート済みのため最も遅いものが残る）
                dailyRecords[key].lastLeaveTime = timeStr;
                dailyRecords[key].lastLeaveRaw = rawTime;
            }
            if (log.status === '遅刻') {
                dailyRecords[key].excusedLate = true;
            }
            if (log.status === '欠席') {
                dailyRecords[key].excusedAbsent = true;
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
        let absentDaysExcused = 0;
        let absentDaysUnexcused = 0;
        let holidayDays = 0;
        let holidayTimeMs = 0;
        let lateCountExcused = 0;
        let lateCountUnexcused = 0;
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

                const isOffDate = systemSettings.offDates && systemSettings.offDates.includes(yyyyMmDd);
                const isExplicitWeekday = systemSettings.weekdayDates && systemSettings.weekdayDates.includes(yyyyMmDd);
                const customTimeObj = systemSettings.customDates && systemSettings.customDates[yyyyMmDd];

                if (isHoliday || (dayOfWeek === 0 && !isExplicitWeekday && !customTimeObj)) { // 休日設定または日曜日（ただし強制平日がない場合）
                    holidayDays++;
                    if (lastLeaveObj) {
                        holidayTimeMs += (lastLeaveObj.getTime() - firstAttendObj.getTime());
                    }
                } else if (!isOffDate) { // オフ日じゃなければ計算

                    const reqStart = new Date(currentDate);
                    const reqEnd = new Date(currentDate);
                    
                    if (customTimeObj) {
                        const [startH, startM] = customTimeObj.start.split(':');
                        const [endH, endM] = customTimeObj.end.split(':');
                        reqStart.setHours(parseInt(startH, 10), parseInt(startM, 10), 0, 0);
                        reqEnd.setHours(parseInt(endH, 10), parseInt(endM, 10), 0, 0);
                    } else if (isExplicitWeekday || (dayOfWeek >= 1 && dayOfWeek <= 5)) { // 強制平日 または 月〜金
                        reqStart.setHours(16, 30, 0, 0);
                        reqEnd.setHours(18, 30, 0, 0);
                    } else if (dayOfWeek === 6) { // 土曜日は9:30-18:30を標準の活動時間とみなす
                        reqStart.setHours(9, 30, 0, 0);
                        reqEnd.setHours(18, 30, 0, 0);
                    }

                    // 遅刻の判定 (15分の猶予)
                    const reqStartGrace = new Date(reqStart.getTime() + 15 * 60000);
                    if (firstAttendObj > reqStartGrace) {
                        if (record.excusedLate) {
                            lateCountExcused++;
                        } else {
                            lateCountUnexcused++;
                        }
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
                const isOffDate = systemSettings.offDates && systemSettings.offDates.includes(yyyyMmDd);
                const isExplicitWeekday = systemSettings.weekdayDates && systemSettings.weekdayDates.includes(yyyyMmDd);
                const customTimeObj = systemSettings.customDates && systemSettings.customDates[yyyyMmDd];
                
                if (!isHoliday && (dayOfWeek !== 0 || isExplicitWeekday || customTimeObj) && !isOffDate) { // 休日と日曜日・指定休養日以外は活動日
                    if (record && record.excusedAbsent) {
                        absentDaysExcused++;
                    } else {
                        absentDaysUnexcused++;
                    }
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
        document.getElementById('stats-absent').innerText = `${absentDaysExcused + absentDaysUnexcused} 日`;
        document.getElementById('stats-absent-excused').innerText = `${absentDaysExcused} 日`;
        document.getElementById('stats-absent-unexcused').innerText = `${absentDaysUnexcused} 日`;

        document.getElementById('stats-holiday-count').innerText = `${holidayDays} 日`;
        document.getElementById('stats-late-count').innerText = `${lateCountExcused + lateCountUnexcused} 回`;
        document.getElementById('stats-late-excused').innerText = `${lateCountExcused} 回`;
        document.getElementById('stats-late-unexcused').innerText = `${lateCountUnexcused} 回`;
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
                finalStatus: '連絡無し', 
                attended: false, 
                firstAttendTime: null, 
                lastLeaveTime: null,
                excusedLate: false,
                excusedAbsent: false
            };
        });

        dayLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        dayLogs.forEach(log => {
            if (!memberStats[log.name]) return;
            const ms = memberStats[log.name];
            ms.finalStatus = log.status;
            
            const logTime = new Date(log.timestamp).getTime();

            if (log.status === '出席' || log.status === '遅刻') {
                ms.attended = true;
                if (!ms.firstAttendTime || logTime < ms.firstAttendTime) ms.firstAttendTime = logTime;
                ms.lastLeaveTime = null; // 再出席時はリセット
            } else if (log.status === '退席' || log.status === '早退') {
                ms.lastLeaveTime = logTime;
            }
            if (log.status === '遅刻') ms.excusedLate = true;
            if (log.status === '欠席') ms.excusedAbsent = true;
        });

        let attendCount = 0;
        let absentExcusedCount = 0;
        let absentUnexcusedCount = 0;
        let lateExcusedCount = 0;
        let lateUnexcusedCount = 0;
        let earlyCount = 0;
        let otherCount = 0;

        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay();
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 0;
        const isHoliday = systemSettings.holidayDates && systemSettings.holidayDates.includes(dateStr);
        const isOffDate = systemSettings.offDates && systemSettings.offDates.includes(dateStr);
        const isWeekdayDate = systemSettings.weekdayDates && systemSettings.weekdayDates.includes(dateStr);
        const customTimeObj = systemSettings.customDates && systemSettings.customDates[dateStr];
        const isSpecialDay = (isSaturday || isHoliday) && !isWeekdayDate && !customTimeObj;
        
        let actualStart = new Date(`${dateStr}T${isSpecialDay ? '09:30:00' : '16:30:00'}`).getTime();
        let actualEnd = new Date(`${dateStr}T18:30:00`).getTime();
        if (customTimeObj) {
            actualStart = new Date(`${dateStr}T${customTimeObj.start}:00`).getTime();
            actualEnd = new Date(`${dateStr}T${customTimeObj.end}:00`).getTime();
        }

        Object.values(memberStats).forEach(ms => {
            if (ms.attended) {
                attendCount++;
                if (!isSunday || isHoliday || isWeekdayDate || customTimeObj) {
                    if (!isOffDate) {
                        // 15分の猶予を持たせる
                        if (ms.firstAttendTime > actualStart + (15 * 60000)) {
                            if (ms.excusedLate) lateExcusedCount++;
                            else lateUnexcusedCount++;
                        }
                        if (ms.lastLeaveTime && ms.lastLeaveTime < actualEnd) earlyCount++;
                    }
                }
            } else {
                const isOffDay = isSunday || isHoliday || isOffDate;
                if (!isOffDay && !isWeekdayDate && !customTimeObj) {
                    if (ms.excusedAbsent || ms.finalStatus === '欠席') {
                        absentExcusedCount++;
                    } else if (ms.finalStatus === '連絡無し') {
                        absentUnexcusedCount++;
                    }
                } else if (ms.finalStatus === '欠席') {
                    absentExcusedCount++;
                } else {
                    otherCount++;
                }
            }
        });

        document.getElementById('daily-date-label').textContent = dateStr;

        let ruleText = "通常活動日 (16:30〜18:30)";
        let ruleColor = "#4338ca"; // Indigo
        if (isOffDate) {
            ruleText = "休み (部活なし)";
            ruleColor = "#10b981"; // Emerald
        } else if (customTimeObj) {
            ruleText = `時間指定 (${customTimeObj.start}〜${customTimeObj.end})`;
            ruleColor = "#7E22CE"; // Purple
        } else if (isHoliday) {
            ruleText = "土曜扱い (9:30〜18:30)";
            ruleColor = "#d97706"; // amber
        } else if (isWeekdayDate) {
            ruleText = "平日扱い (16:30〜18:30)";
            ruleColor = "#2563eb"; // blue
        } else if (isSunday) {
            ruleText = "日曜日 (通常休み)";
            ruleColor = "#64748b"; // slate
        } else if (isSaturday) {
            ruleText = "土曜日 (9:30〜18:30)";
            ruleColor = "#0284c7"; // light blue
        }

        const ruleLabel = document.getElementById('daily-rule-label');
        if (ruleLabel) {
            ruleLabel.textContent = ruleText;
            ruleLabel.style.color = ruleColor;
        }

        document.getElementById('daily-attend-count').textContent = `${attendCount} 人`;
        document.getElementById('daily-late-count').textContent = `${lateExcusedCount + lateUnexcusedCount} 人`;
        let lateExcusedEl = document.getElementById('daily-late-excused-count');
        if(lateExcusedEl) lateExcusedEl.textContent = `${lateExcusedCount} 人`;
        let lateUnexcusedEl = document.getElementById('daily-late-unexcused-count');
        if(lateUnexcusedEl) lateUnexcusedEl.textContent = `${lateUnexcusedCount} 人`;
        
        document.getElementById('daily-early-count').textContent = `${earlyCount} 人`;

        document.getElementById('daily-absent-count').textContent = `${absentExcusedCount + absentUnexcusedCount} 人`;
        let absentExcusedEl = document.getElementById('daily-absent-excused-count');
        if(absentExcusedEl) absentExcusedEl.textContent = `${absentExcusedCount} 人`;
        let absentUnexcusedEl = document.getElementById('daily-absent-unexcused-count');
        if(absentUnexcusedEl) absentUnexcusedEl.textContent = `${absentUnexcusedCount} 人`;

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

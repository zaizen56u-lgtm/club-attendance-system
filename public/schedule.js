document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const calendarEl = document.getElementById('calendar');

    function applyDynamicColors(settings) {
        // 色分けは廃止したため、カレンダーのスタイル操作は行わない
    }

    let currentSettings = {};
    let currentTeamView = window.currentTeamView || 'ALL'; // HTML側で指定された変数を読み込む

    socket.emit('getSettings', (res) => {
        if(res.success) {
            currentSettings = res.settings;
            applyDynamicColors(res.settings);
        }
    });
    socket.on('settingsUpdated', (newSettings) => {
        currentSettings = newSettings;
        applyDynamicColors(newSettings);
    });

    let calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        height: 'auto',
        selectable: true, // クリックやドラッグで予定作成可能に
        dateClick: function(info) {
            const dateStr = info.dateStr;
            const dateObj = new Date(dateStr);
            const dayOfWeek = dateObj.getDay();
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isHoliday = currentSettings.holidayDates && currentSettings.holidayDates.includes(dateStr);
            const isOffDate = currentSettings.offDates && currentSettings.offDates.includes(dateStr);
            const isWeekdayDate = currentSettings.weekdayDates && currentSettings.weekdayDates.includes(dateStr);

            let ruleText = "通常活動日 (16:30〜18:30)";
            let ruleColor = "#4338ca";
            if (isOffDate) {
                ruleText = "休み (部活なし)";
                ruleColor = "#10b981"; 
            } else if (isHoliday) {
                ruleText = "土曜扱い (9:30〜18:30)";
                ruleColor = "#d97706"; 
            } else if (isWeekdayDate) {
                ruleText = "平日扱い (16:30〜18:30)";
                ruleColor = "#2563eb"; 
            } else if (isSunday) {
                ruleText = "日曜日 (通常休み)";
                ruleColor = "#64748b"; 
            } else if (isSaturday) {
                ruleText = "土曜日 (9:30〜18:30)";
                ruleColor = "#0284c7"; 
            }

            document.getElementById('daily-date-label').textContent = dateStr;
            const lbl = document.getElementById('daily-rule-label');
            lbl.textContent = ruleText;
            lbl.style.color = ruleColor;
            document.getElementById('daily-summary-panel').style.display = 'block';
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: '今日', month: '月', week: '週', day: '日'
        },
        events: function(info, successCallback, failureCallback) {
            // カレンダーが期間を変更するたびにサーバーから予定一覧を取得
            socket.emit('getSchedules', (res) => {
                if (res.success) {
                    const filtered = res.schedules.filter(s => {
                        const sTeam = s.team || 'ALL'; // 過去データ等チームが無い場合は全体とする
                        if (currentTeamView === 'A') return sTeam === 'A' || sTeam === 'ALL';
                        if (currentTeamView === 'B') return sTeam === 'B' || sTeam === 'ALL';
                        if (currentTeamView === 'ALL') return sTeam === 'ALL';
                        return true;
                    });
                    successCallback(filtered);
                } else {
                    failureCallback(res.message);
                }
            });
        },
        select: function(info) {
            let label = currentTeamView === 'ALL' ? '部全体(共通)' : currentTeamView + 'チーム';
            const title = prompt(`[${label}] 追加する予定のタイトルを入力してください:`);
            if (!title) { calendar.unselect(); return; }
            
            const pw = prompt('管理者用パスワードを入力してください (追加・編集権限):');
            if (pw !== '51068010A') {
                alert('パスワードが違います。予定の追加は管理者のみ可能です。');
                calendar.unselect(); return;
            }

            let eventColor = '#3B82F6'; // デフォルト: 青
            if (currentTeamView === 'A') eventColor = '#EF4444'; // 赤
            if (currentTeamView === 'B') eventColor = '#10B981'; // 緑

            socket.emit('addSchedule', {
                adminPassword: pw,
                schedule: {
                    title: title,
                    start: info.startStr,
                    end: info.endStr,
                    allDay: info.allDay,
                    color: eventColor,
                    team: currentTeamView
                }
            }, (res) => {
                if(!res.success) alert(res.message);
            });
            calendar.unselect();
        },
        eventClick: function(info) {
            if (confirm(`予定「${info.event.title}」を削除しますか？`)) {
                const pw = prompt('管理者用パスワードを入力してください:');
                if (pw !== '51068010A') {
                    alert('パスワードが違います。削除は管理者のみ可能です。');
                    return;
                }
                socket.emit('deleteSchedule', {
                    adminPassword: pw,
                    scheduleId: info.event.id
                }, (res) => {
                    if(!res.success) alert(res.message);
                });
            }
        }
    });

    calendar.render();

    // 誰かが予定を追加・削除したら即座に再描画する
    socket.on('schedulesUpdated', () => {
        calendar.refetchEvents();
    });
});

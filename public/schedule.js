document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const calendarEl = document.getElementById('calendar');

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

    socket.emit('getSettings', (res) => {
        if(res.success) applyDynamicColors(res.settings);
    });
    socket.on('settingsUpdated', (newSettings) => {
        applyDynamicColors(newSettings);
    });

    let calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ja',
        height: 'auto',
        selectable: true, // クリックやドラッグで予定作成可能に
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
                    successCallback(res.schedules);
                } else {
                    failureCallback(res.message);
                }
            });
        },
        select: function(info) {
            const title = prompt('追加する予定のタイトルを入力してください:');
            if (!title) { calendar.unselect(); return; }
            
            const pw = prompt('管理者用パスワードを入力してください (追加・編集権限):');
            if (pw !== '51068010A') {
                alert('パスワードが違います。予定の追加は管理者のみ可能です。');
                calendar.unselect(); return;
            }

            socket.emit('addSchedule', {
                adminPassword: pw,
                schedule: {
                    title: title,
                    start: info.startStr,
                    end: info.endStr,
                    allDay: info.allDay,
                    color: '#3B82F6' // 青色に設定
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

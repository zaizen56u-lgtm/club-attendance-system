const ioSocket = io();

// サーバーからの強制リロード命令
ioSocket.on('forceReload', () => {
    window.location.reload();
});

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const alertBox = document.getElementById('alert-box');
    const adminPasswordInput = document.getElementById('admin-password');
    const addForm = document.getElementById('add-member-form');
    const removeForm = document.getElementById('remove-member-form');
    const removeSelect = document.getElementById('remove-member-select');
    const bulkContainer = document.getElementById('bulk-members-container');
    const bulkForm = document.getElementById('bulk-update-form');
    const settingsForm = document.getElementById('settings-form');
    
    // 過去の出欠状況修正用
    const pastMemberSelect = document.getElementById('past-member-select');
    const overridePastForm = document.getElementById('override-past-form');
    const pastTargetDate = document.getElementById('past-target-date');
    const pastStatusSelect = document.getElementById('past-status-select');
    const pastLateTimeContainer = document.getElementById('past-late-time-container');
    const pastLateTime = document.getElementById('past-late-time');
    const pastOverridePassword = document.getElementById('past-override-password');

    // === 緊急事態機能の初期化 ===
    const triggerBtn = document.getElementById('btn-trigger-emergency');
    const resolveBtn = document.getElementById('btn-resolve-emergency');
    const emergencyReasonInput = document.getElementById('emergency-reason');
    
    if (triggerBtn && resolveBtn) {
        socket.on('emergencyStateUpdate', (state) => {
            if (state.active) {
                triggerBtn.style.display = 'none';
                resolveBtn.style.display = 'block';
                emergencyReasonInput.value = state.reason;
                emergencyReasonInput.disabled = true;
                emergencyReasonInput.style.background = '#fee2e2';
            } else {
                triggerBtn.style.display = 'block';
                resolveBtn.style.display = 'none';
                emergencyReasonInput.value = '';
                emergencyReasonInput.disabled = false;
                emergencyReasonInput.style.background = 'white';
            }
        });
        socket.emit('checkEmergencyState');

        triggerBtn.addEventListener('click', () => {
            const emergencyPass = prompt('緊急事態発令用パスワードを入力してください:');
            if (!emergencyPass) return;
            
            if (!confirm('本当に発令しますか？全部員の画面がロックされ、本日は強制休日扱いとなります。')) return;
            
            const reason = emergencyReasonInput.value.trim();
            socket.emit('triggerEmergency', { emergencyPassword: emergencyPass, reason }, (res) => {
                if (res.success) {
                    showAlert('成功', '非常事態措置を発令し、全画面を強制ロックしました。', 'success');
                    if (typeof loadSettings === 'function') loadSettings();
                } else {
                    showAlert('エラー', res.message || '権限がありません。', 'error');
                }
            });
        });

        resolveBtn.addEventListener('click', () => {
            const emergencyPass = prompt('緊急事態解除用パスワードを入力してください:');
            if (!emergencyPass) return;
            
            if (!confirm('本当に解除して通常状態に戻しますか？')) return;
            
            socket.emit('resolveEmergency', { emergencyPassword: emergencyPass }, (res) => {
                if (res.success) {
                    showAlert('成功', 'システムロックを解除しました。', 'success');
                } else {
                    showAlert('エラー', res.message || '権限がありません。', 'error');
                }
            });
        });
    }

    // 削除用・修正用リストの読み込み
    function loadMembers() {
        removeSelect.innerHTML = '<option value="" disabled selected>名前を選択してください</option>';
        pastMemberSelect.innerHTML = '<option value="" disabled selected>名前を選択</option>';
        fetch('/api/members')
            .then(res => res.json())
            .then(members => {
                bulkContainer.innerHTML = '';
                members.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name;
                    removeSelect.appendChild(opt);

                    const opt2 = document.createElement('option');
                    opt2.value = m.id;
                    opt2.textContent = m.name;
                    pastMemberSelect.appendChild(opt2);

                    // 一括変更用の行生成
                    const row = document.createElement('div');
                    row.className = 'bulk-member-row';
                    row.dataset.id = m.id;
                    row.dataset.name = m.name;
                    row.dataset.origStatus = m.status;
                    row.dataset.origLocation = m.location;
                    row.style.cssText = "display: flex; gap: 10px; align-items: center; background: #F9FAFB; padding: 4px 10px; border-radius: 8px;";
                    
                    row.innerHTML = `
                        <div style="flex: 1; font-weight: bold;">${m.name}</div>
                        <select class="bulk-status" style="width: 90px; padding: 6px; border-radius: 4px; border: 1px solid #D1D5DB;">
                            <option value="-" ${m.status==='-'?'selected':''}>-</option>
                            <option value="出席" ${m.status==='出席'?'selected':''}>出席</option>
                            <option value="退席" ${m.status==='退席'?'selected':''}>退席</option>
                            <option value="遅刻" ${m.status==='遅刻'?'selected':''}>遅刻</option>
                            <option value="欠席" ${m.status==='欠席'?'selected':''}>欠席</option>
                            <option value="休憩" ${m.status==='休憩'?'selected':''}>休憩</option>
                            <option value="一時外出" ${m.status==='一時外出'?'selected':''}>一時外出</option>
                        </select>
                        <select class="bulk-location" style="width: 130px; padding: 6px; border-radius: 4px; border: 1px solid #D1D5DB;">
                            <option value="-" ${m.location==='-'?'selected':''}>-</option>
                            <option value="体育館" ${m.location==='体育館'?'selected':''}>体育館</option>
                            <option value="部室（加工場）" ${m.location==='部室（加工場）'?'selected':''}>部室（加工場）</option>
                            <option value="校内" ${m.location==='校内'?'selected':''}>校内</option>
                        </select>
                    `;
                    bulkContainer.appendChild(row);
                });
            });
    }

    const overrideStartDateInput = document.getElementById('override-start-date');
    const overrideEndDateInput = document.getElementById('override-end-date');
    const overrideTypeSelect = document.getElementById('override-type');
    const customTimeInputs = document.getElementById('custom-time-inputs');
    const overrideStartTime = document.getElementById('override-start-time');
    const overrideEndTime = document.getElementById('override-end-time');
    const addOverrideBtn = document.getElementById('add-override-btn');

    overrideTypeSelect.addEventListener('change', () => {
        if (overrideTypeSelect.value === 'custom') {
            customTimeInputs.style.display = 'flex';
        } else {
            customTimeInputs.style.display = 'none';
        }
    });
    const overrideDatesList = document.getElementById('override-dates-list');

    let currentWeekdayDates = [];
    let currentHolidayDates = [];
    let currentOffDates = [];
    let currentCustomDates = {};

    function getTypeLabel(type) {
        if(type === 'weekday') return { label: '平日扱い (16:30〜)', color: '#2563EB', bg: '#EFF6FF' };
        if(type === 'holiday') return { label: '土曜扱い (9:30〜)', color: '#D97706', bg: '#FEF3C7' };
        if(type === 'off') return { label: '休み (部活なし)', color: '#059669', bg: '#D1FAE5' };
        return { label: '', color: '#000', bg: '#fff' };
    }

    function renderOverrideDates() {
        overrideDatesList.innerHTML = '';
        
        let allOverrides = [];
        currentWeekdayDates.forEach(d => allOverrides.push({ date: d, type: 'weekday' }));
        currentHolidayDates.forEach(d => allOverrides.push({ date: d, type: 'holiday' }));
        currentOffDates.forEach(d => allOverrides.push({ date: d, type: 'off' }));
        Object.keys(currentCustomDates).forEach(d => allOverrides.push({ date: d, type: 'custom', timeStr: `${currentCustomDates[d].start}〜${currentCustomDates[d].end}` }));
        
        allOverrides.sort((a,b) => a.date.localeCompare(b.date));

        allOverrides.forEach(item => {
            let style;
            if (item.type === 'custom') {
                style = { label: `時間指定 (${item.timeStr})`, color: '#7E22CE', bg: '#F3E8FF' }; // Purple for custom
            } else {
                style = getTypeLabel(item.type);
            }
            const li = document.createElement('li');
            li.style.cssText = `background: ${style.bg}; color: ${style.color}; padding: 4px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 0.95rem;`;
            li.innerHTML = `
                <span><strong>${item.date}</strong> : ${style.label}</span>
                <button type="button" data-date="${item.date}" data-type="${item.type}" class="remove-override-btn" style="border: none; background: transparent; color: ${style.color}; cursor: pointer; line-height: 1; font-size: 1.2rem; margin-left: 5px;">&times;</button>
            `;
            overrideDatesList.appendChild(li);
        });

        document.querySelectorAll('.remove-override-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const removeDate = e.target.dataset.date;
                const removeType = e.target.dataset.type;
                if (removeType === 'weekday') currentWeekdayDates = currentWeekdayDates.filter(d => d !== removeDate);
                if (removeType === 'holiday') currentHolidayDates = currentHolidayDates.filter(d => d !== removeDate);
                if (removeType === 'off') currentOffDates = currentOffDates.filter(d => d !== removeDate);
                if (removeType === 'custom') delete currentCustomDates[removeDate];
                renderOverrideDates();
            });
        });
    }

    addOverrideBtn.addEventListener('click', () => {
        const startVal = overrideStartDateInput.value;
        const endVal = overrideEndDateInput.value;
        const typeVal = overrideTypeSelect.value;
        if (!startVal || !endVal) return;

        const start = new Date(startVal);
        const end = new Date(endVal);
        if (start > end) {
            showAlert('エラー', '終了日は開始日以降にしてください。', 'error');
            return;
        }

        let current = new Date(start);
        let added = false;
        while (current <= end) {
            const localDate = new Date(current.getTime() - (current.getTimezoneOffset() * 60000));
            const dateStr = localDate.toISOString().split('T')[0];

            currentWeekdayDates = currentWeekdayDates.filter(d => d !== dateStr);
            currentHolidayDates = currentHolidayDates.filter(d => d !== dateStr);
            currentOffDates = currentOffDates.filter(d => d !== dateStr);
            delete currentCustomDates[dateStr];

            if (typeVal === 'weekday') currentWeekdayDates.push(dateStr);
            if (typeVal === 'holiday') currentHolidayDates.push(dateStr);
            if (typeVal === 'off') currentOffDates.push(dateStr);
            if (typeVal === 'custom') {
                currentCustomDates[dateStr] = { start: overrideStartTime.value, end: overrideEndTime.value };
            }
            
            added = true;
            current.setDate(current.getDate() + 1);
        }

        if (added) renderOverrideDates();
        overrideStartDateInput.value = '';
        overrideEndDateInput.value = '';
    });

    function loadSettings() {
        socket.emit('getSettings', (res) => {
            if (res.success) {
                currentWeekdayDates = res.settings.weekdayDates || [];
                currentHolidayDates = res.settings.holidayDates || [];
                currentOffDates = res.settings.offDates || [];
                currentCustomDates = res.settings.customDates || {};
                renderOverrideDates();
            }
        });
    }

    loadMembers();
    loadSettings();

    socket.on('memberListUpdated', () => {
        loadMembers();
    });

    // メンバー追加処理
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const adminPassword = adminPasswordInput.value;
        const name = document.getElementById('new-member-name').value;
        const password = document.getElementById('new-member-password').value;

        if (!adminPassword) {
            showAlert('エラー', '設定用パスワードを入力してください。', 'error');
            return;
        }

        socket.emit('addMember', { adminPassword, name, password }, (res) => {
            if (res.success) {
                showAlert('成功', `${name} さんを追加しました。`, 'success');
                document.getElementById('new-member-name').value = '';
                document.getElementById('new-member-password').value = '';
            } else {
                showAlert('エラー', res.message, 'error');
            }
        });
    });

    // メンバー削除処理
    removeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const adminPassword = adminPasswordInput.value;
        const id = removeSelect.value;
        const name = removeSelect.options[removeSelect.selectedIndex]?.textContent;

        if (!adminPassword) {
            showAlert('エラー', '設定用パスワードを入力してください。', 'error');
            return;
        }
        if (!id) return;

        if (!confirm(`本当に ${name} さんを削除しますか？`)) {
            return;
        }

        socket.emit('removeMember', { adminPassword, id }, (res) => {
            if (res.success) {
                showAlert('成功', `${name} さんを削除しました。`, 'success');
                removeSelect.value = '';
            } else {
                showAlert('エラー', res.message, 'error');
            }
        });
    });

    // メンバー一括変更処理
    bulkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const adminPassword = adminPasswordInput.value;
        if (!adminPassword) {
            showAlert('エラー', '設定用パスワードを入力してください。', 'error');
            return;
        }

        const rows = document.querySelectorAll('.bulk-member-row');
        let updatePromises = [];
        let updatedCount = 0;

        rows.forEach(row => {
            const id = row.dataset.id;
            const name = row.dataset.name;
            const origStatus = row.dataset.origStatus;
            const origLocation = row.dataset.origLocation;
            const status = row.querySelector('.bulk-status').value;
            const location = row.querySelector('.bulk-location').value;

            if (status !== origStatus || location !== origLocation) {
                const reason = (status === '欠席' || status === '遅刻' || status === '一時外出') ? '管理者による強制変更' : '';
                updatedCount++;
                updatePromises.push(new Promise((resolve) => {
                    socket.emit('updateStatus', { id, password: adminPassword, newStatus: status, newLocation: location, reason }, (res) => {
                        resolve(res); // 以前の resolve(res.success) から res 全体を返すように変更
                    });
                }));
            }
        });

        if (updatedCount === 0) {
            showAlert('情報', '変更された部員はいませんでした。', 'success');
            return;
        }

        Promise.all(updatePromises).then(results => {
            const successCount = results.filter(r => r.success).length;
            if (successCount === 0) {
                // 失敗した理由を集めて表示する
                const errorMsg = results.find(r => !r.success)?.message || "不明なエラー";
                showAlert('エラー', `更新0名。理由: ${errorMsg}`, 'error');
            } else {
                showAlert('成功', `${successCount}名のステータスを一括更新しました！`, 'success');
            }
            loadMembers(); // 全てのフォーム項目を最新の状態にリセット
        });
    });

    // 休日設定更新処理
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const adminPassword = adminPasswordInput.value;
        if (!adminPassword) {
            alert('【エラー】設定用パスワードを入力してから保存ボタンを押してください！');
            showAlert('エラー', '設定用パスワードを入力してください。', 'error');
            return;
        }
        
        socket.emit('updateSettings', { adminPassword, newSettings: { weekdayDates: currentWeekdayDates, holidayDates: currentHolidayDates, offDates: currentOffDates, customDates: currentCustomDates } }, (res) => {
            if (res.success) {
                alert('【成功】設定を保存しました！カレンダーをご確認ください。');
                showAlert('成功', '例外日程を保存しました。', 'success');
            } else {
                alert('【エラー】' + res.message);
                showAlert('エラー', res.message, 'error');
            }
        });
    });

    // 過去の出欠状況の上書き処理
    if (pastStatusSelect) {
        pastStatusSelect.addEventListener('change', () => {
            if (pastStatusSelect.value === '遅刻') {
                pastLateTimeContainer.style.display = 'block';
            } else {
                pastLateTimeContainer.style.display = 'none';
            }
        });
    }

    if (overridePastForm) {
        overridePastForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const date = pastTargetDate.value;
            const memberId = pastMemberSelect.value;
            const status = pastStatusSelect.value;
            const timeStr = pastLateTime.value;
            const password = pastOverridePassword.value;

            if (!memberId) {
                showAlert('エラー', '対象のメンバーを選択してください', 'error');
                return;
            }

            if (!confirm(`${date} の記録を「${status}」で完全に上書きしますか？\n（この操作は取り消せません）`)) {
                return;
            }

            socket.emit('overridePastAttendance', {
                password,
                memberId,
                targetDate: date,
                newStatus: status,
                customTimeStr: timeStr
            }, (res) => {
                if (res.success) {
                    showAlert('成功', '過去の出欠状況を上書きしました！カレンダーをご確認ください。', 'success');
                    pastOverridePassword.value = '';
                } else {
                    showAlert('エラー', res.message, 'error');
                }
            });
        });
    }

    // 履歴・状況の全消去処理
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            const adminPassword = document.getElementById('admin-password').value;
            if (!adminPassword) {
                showAlert('エラー', '管理用パスワードを入力してください。', 'error');
                return;
            }
            
            if (!confirm('⚠️ 警告\n本当に全ての出欠状況と活動記録（履歴）を完全に消去しますか？\n（この操作は絶対に取り消せません。年度替わり等のリセットのみに使用してください）')) {
                return;
            }
            
            // 念のため二重確認
            if (!confirm('最終確認です。全てのデータが消えます。よろしいですか？')) {
                return;
            }

            socket.emit('clearAllHistory', { adminPassword }, (response) => {
                if (response.success) {
                    showAlert('成功', '全ての活動記録とステータスを初期化しました。', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showAlert('エラー', response.message || '消去に失敗しました。', 'error');
                }
            });
        });
    }

    function showAlert(title, message, type) {
        alertBox.textContent = `[${title}] ${message}`;
        alertBox.className = `alert ${type}`;
        alertBox.classList.remove('hidden');
        setTimeout(() => {
            alertBox.classList.add('hidden');
        }, 5000);
    }
});

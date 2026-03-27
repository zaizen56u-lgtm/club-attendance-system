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

    // 削除用リストの読み込み
    function loadMembers() {
        removeSelect.innerHTML = '<option value="" disabled selected>名前を選択してください</option>';
        fetch('/api/members')
            .then(res => res.json())
            .then(members => {
                bulkContainer.innerHTML = '';
                members.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name;
                    removeSelect.appendChild(opt);

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
                            <option value="休憩" ${m.status==='休憩'?'selected':''}>休憩</option>
                            <option value="外出" ${m.status==='外出'?'selected':''}>外出</option>
                            <option value="早退" ${m.status==='早退'?'selected':''}>早退</option>
                            <option value="欠席" ${m.status==='欠席'?'selected':''}>欠席</option>
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

    // 設定情報の読み込み
    const holidayDateInput = document.getElementById('holiday-date-input');
    const addHolidayBtn = document.getElementById('add-holiday-btn');
    const holidayDatesList = document.getElementById('holiday-dates-list');
    let currentHolidayDates = [];

    function renderHolidayDates() {
        holidayDatesList.innerHTML = '';
        currentHolidayDates.sort(); // 日付順にソート
        currentHolidayDates.forEach(dateStr => {
            const li = document.createElement('li');
            li.style.cssText = "background: #FEE2E2; color: #B91C1C; padding: 2px 10px; border-radius: 20px; display: flex; align-items: center; gap: 8px;";
            li.innerHTML = `
                <span>${dateStr}</span>
                <button type="button" data-date="${dateStr}" class="remove-holiday-btn" style="border: none; background: transparent; color: #991B1B; cursor: pointer; line-height: 1;">&times;</button>
            `;
            holidayDatesList.appendChild(li);
        });
        document.querySelectorAll('.remove-holiday-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const removeDate = e.target.dataset.date;
                currentHolidayDates = currentHolidayDates.filter(d => d !== removeDate);
                renderHolidayDates();
            });
        });
    }

    addHolidayBtn.addEventListener('click', () => {
        const dateVal = holidayDateInput.value;
        if (!dateVal) return;
        if (!currentHolidayDates.includes(dateVal)) {
            currentHolidayDates.push(dateVal);
            renderHolidayDates();
        }
        holidayDateInput.value = '';
    });

    function loadSettings() {
        socket.emit('getSettings', (res) => {
            if (res.success) {
                currentHolidayDates = res.settings.holidayDates || [];
                renderHolidayDates();
            }
        });
    }

    function loadNetworkInfo() {
        const qrContainer = document.getElementById('qrcode-container');
        const urlInput = document.getElementById('share-url-input');
        if(!qrContainer) return;

        // クライアントがアクセスしているベースURLを直接取得することで
        // ローカル環境、およびすべてのクラウドホスティング環境に一律対応させます
        const targetUrl = window.location.origin;
        urlInput.value = targetUrl;
        
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: targetUrl,
            width: 140,
            height: 140,
            colorDark : "#0f172a",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.M
        });
            
        document.getElementById('copy-url-btn').addEventListener('click', () => {
            urlInput.select();
            document.execCommand('copy');
            showAlert('情報', '共有用URLをクリップボードにコピーしました！', 'success');
        });
    }

    loadMembers();
    loadSettings();
    loadNetworkInfo();

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

            // 変更があった部員だけを更新キューに入れる
            if (status !== origStatus || location !== origLocation) {
                updatedCount++;
                updatePromises.push(new Promise((resolve) => {
                    socket.emit('updateStatus', { id, password: adminPassword, newStatus: status, newLocation: location }, (res) => {
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
            showAlert('エラー', '設定用パスワードを入力してください。', 'error');
            return;
        }
        
        socket.emit('updateSettings', { adminPassword, newSettings: { holidayDates: currentHolidayDates } }, (res) => {
            if (res.success) {
                showAlert('成功', '休日設定を更新しました。', 'success');
            } else {
                showAlert('エラー', res.message, 'error');
            }
        });
    });

    function showAlert(title, message, type) {
        alertBox.textContent = `[${title}] ${message}`;
        alertBox.className = `alert ${type}`;
        alertBox.classList.remove('hidden');
        setTimeout(() => {
            alertBox.classList.add('hidden');
        }, 5000);
    }
});

const globalSocket = io();

// サーバーからの強制リロード命令
globalSocket.on('forceReload', () => {
    window.location.reload();
});

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const alertBox = document.getElementById('alert-box');
    const memberSelect = document.getElementById('member-select');
    const locationSelect = document.getElementById('location-select');
    const statusButtons = document.querySelectorAll('.status-btn');
    const selectedStatusInput = document.getElementById('selected-status');
    const reasonGroup = document.getElementById('reason-group');
    const reasonInput = document.getElementById('reason-input');
    const submitBtn = document.getElementById('submit-btn');
    const form = document.getElementById('attendance-form');

    // メンバーリストの取得とドロップダウンへのセット
    fetch('/api/members')
        .then(response => response.json())
        .then(members => {
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name;
                memberSelect.appendChild(option);
            });
        })
        .catch(err => {
            showAlert('エラー', 'メンバーリストの取得に失敗しました。', 'error');
        });

    // 状況ボタンの切り替え
    const statusBtns = document.querySelectorAll('.status-btn');
    const reasonLabel = document.getElementById('reason-label');
    const longTermGroup = document.getElementById('long-term-group');
    const longTermStart = document.getElementById('long-term-start');
    const longTermEnd = document.getElementById('long-term-end');
    const locationFormGroup = locationSelect.closest('.form-group');

    statusBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            statusBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedStatusInput.value = btn.dataset.status;
            
            // 長期休暇の場合
            if (btn.dataset.status === '長期休暇') {
                reasonGroup.style.display = 'block';
                reasonLabel.innerHTML = '長期休暇の理由・詳細 <span style="color:red; font-size:0.85em;">(必須)</span>';
                longTermGroup.style.display = 'block';
                if(locationFormGroup) locationFormGroup.style.display = 'none';
            } 
            // 理由が必要なステータスの場合
            else if (btn.dataset.status === '欠席' || btn.dataset.status === '遅刻' || btn.dataset.status === '一時外出') {
                reasonGroup.style.display = 'block';
                reasonLabel.innerHTML = btn.dataset.status === '一時外出' ? '用件／行先 <span style="color:red; font-size:0.85em;">(必須)</span>' : '理由・詳細 <span style="color:red; font-size:0.85em;">(必須)</span>';
                longTermGroup.style.display = 'none';
                if(locationFormGroup) locationFormGroup.style.display = 'block';
            } else {
                reasonGroup.style.display = 'none';
                longTermGroup.style.display = 'none';
                if(locationFormGroup) locationFormGroup.style.display = 'block';
            }
            
            checkFormValidity();
        });
    });

    // 入力変更時にフォームの有効性をチェック
    memberSelect.addEventListener('change', checkFormValidity);
    document.getElementById('password-input').addEventListener('input', checkFormValidity);
    reasonInput.addEventListener('input', checkFormValidity);
    longTermStart.addEventListener('input', checkFormValidity);
    longTermEnd.addEventListener('input', checkFormValidity);

    function checkFormValidity() {
        const member = memberSelect.value;
        const status = selectedStatusInput.value;
        const reason = reasonInput.value.trim();

        let isValid = (member && status);
        
        if (status === '長期休暇') {
            if (reason === '' || !longTermStart.value || !longTermEnd.value) {
                isValid = false;
            }
            if (new Date(longTermStart.value) > new Date(longTermEnd.value)) {
                isValid = false; // 開始日が終了日より後の場合は無効
            }
        }
        else if ((status === '欠席' || status === '遅刻' || status === '一時外出') && reason === '') {
            isValid = false;
        }

        if (isValid) {
            submitBtn.removeAttribute('disabled');
        } else {
            submitBtn.setAttribute('disabled', 'true');
        }
    }

    // フォーム送信
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.textContent = '更新中...';

        const id = memberSelect.value;
        const password = ""; // パスワードは撤廃
        const newStatus = selectedStatusInput.value;
        const newLocation = locationSelect.value;
        
        if (newStatus === '長期休暇') {
            const reason = reasonInput.value.trim();
            const startDate = longTermStart.value;
            const endDate = longTermEnd.value;
            
            socket.emit('submitLongTermLeave', { id, startDate, endDate, reason }, (response) => {
                submitBtn.textContent = '更新する';
                if (response.success) {
                    showAlert('成功', `${response.name}さんの長期休暇(${startDate}〜)を登録しました。`, 'success');
                    document.getElementById('password-input').value = '';
                    reasonInput.value = '';
                    longTermStart.value = '';
                    longTermEnd.value = '';
                    checkFormValidity();
                    setTimeout(() => window.location.href = 'board.html', 1500);
                } else {
                    showAlert('エラー', response.message, 'error');
                    submitBtn.removeAttribute('disabled');
                }
            });
            return;
        }

        const reason = (newStatus === '欠席' || newStatus === '遅刻' || newStatus === '一時外出') ? reasonInput.value.trim() : '';

        // Socket経由で通常ステータス更新を送信
        socket.emit('updateStatus', { id, password, newStatus, newLocation, reason }, (response) => {
            submitBtn.textContent = '更新する';
            
            if (response.success) {
                showAlert('成功', `${response.member.name}さんの状況を「${response.member.status}」(${response.member.location}) に更新しました。`, 'success');
                // フォームをリセット
                document.getElementById('password-input').value = '';
                reasonInput.value = ''; // 理由欄もリセット
                checkFormValidity();
                
                // 少し経ってからアラートを消す
                setTimeout(() => {
                    alertBox.classList.add('hidden');
                }, 4000);
            } else {
                showAlert('エラー', response.message, 'error');
                submitBtn.removeAttribute('disabled');
            }
        });
    });

    // メンバーリストが更新されたら再読み込み
    socket.on('memberListUpdated', () => {
        // 現在の選択を覚えておく
        const currentSelected = memberSelect.value;
        
        memberSelect.innerHTML = '<option value="" disabled selected>名前を選択してください</option>';
        fetch('/api/members')
            .then(response => response.json())
            .then(members => {
                members.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.id;
                    option.textContent = member.name;
                    memberSelect.appendChild(option);
                });
                if(currentSelected) {
                    memberSelect.value = currentSelected;
                }
            });
    });

    function showAlert(title, message, type) {
        alertBox.textContent = `[${title}] ${message}`;
        alertBox.className = `alert ${type}`;
        alertBox.classList.remove('hidden');
    }
});

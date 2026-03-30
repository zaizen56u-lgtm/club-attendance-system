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

    // ステータスボタンの選択制御
    statusButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // 他のボタンの選択を解除
            statusButtons.forEach(b => b.classList.remove('selected'));
            // クリックしたボタンを選択状態に
            btn.classList.add('selected');
            // 隠しフィールドに値を設定
            selectedStatusInput.value = btn.getAttribute('data-status');
            
            // 「欠席」「遅刻」「一時外出」の場合に理由入力欄を表示
            const reasonLabel = document.getElementById('reason-label');
            if (selectedStatusInput.value === '欠席' || selectedStatusInput.value === '遅刻') {
                reasonGroup.style.display = 'block';
                if(reasonLabel) reasonLabel.innerHTML = '欠席・遅刻理由 <span style="color:red; font-size:0.85em;">(必須)</span>';
                reasonInput.placeholder = '例: 体調不良のため、家庭の用事など';
            } else if (selectedStatusInput.value === '一時外出') {
                reasonGroup.style.display = 'block';
                if(reasonLabel) reasonLabel.innerHTML = '用件・行先 <span style="color:red; font-size:0.85em;">(必須)</span>';
                reasonInput.placeholder = '例: 文房具の買い出し、○○へ移動など';
            } else {
                reasonGroup.style.display = 'none';
            }
            
            checkFormValidity();
        });
    });

    // 入力変更時にフォームの有効性をチェック
    memberSelect.addEventListener('change', checkFormValidity);
    document.getElementById('password-input').addEventListener('input', checkFormValidity);
    reasonInput.addEventListener('input', checkFormValidity);

    function checkFormValidity() {
        const password = document.getElementById('password-input').value;
        const member = memberSelect.value;
        const status = selectedStatusInput.value;
        const reason = reasonInput.value.trim();

        let isValid = (password.length > 0 && member && status);
        
        // 欠席・遅刻・一時外出の場合は理由が必須
        if ((status === '欠席' || status === '遅刻' || status === '一時外出') && reason === '') {
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
        const password = document.getElementById('password-input').value;
        const newStatus = selectedStatusInput.value;
        const newLocation = locationSelect.value;
        const reason = (newStatus === '欠席' || newStatus === '遅刻' || newStatus === '一時外出') ? reasonInput.value.trim() : '';

        // Socket経由で更新を送信
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

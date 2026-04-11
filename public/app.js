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

    // カテゴリーの切り替え
    const catTodayBtn = document.getElementById('cat-today-btn');
    const catFutureBtn = document.getElementById('cat-future-btn');
    const sectionToday = document.getElementById('section-today');
    const sectionFuture = document.getElementById('section-future');
    
    // 現在どちらのカテゴリーを選択中か
    let currentCategory = 'today';

    catTodayBtn.addEventListener('click', () => {
        currentCategory = 'today';
        catTodayBtn.style.background = '#fff';
        catTodayBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        catTodayBtn.style.color = '#4F46E5';
        catFutureBtn.style.background = 'transparent';
        catFutureBtn.style.boxShadow = 'none';
        catFutureBtn.style.color = '#64748b';
        
        sectionToday.style.display = 'block';
        sectionFuture.style.display = 'none';
        selectedStatusInput.value = ''; // リセット
        document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
        reasonGroup.style.display = 'none';
        checkFormValidity();
    });

    catFutureBtn.addEventListener('click', () => {
        currentCategory = 'future';
        catFutureBtn.style.background = '#fff';
        catFutureBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        catFutureBtn.style.color = '#4F46E5';
        catTodayBtn.style.background = 'transparent';
        catTodayBtn.style.boxShadow = 'none';
        catTodayBtn.style.color = '#64748b';
        
        sectionFuture.style.display = 'block';
        sectionToday.style.display = 'none';
        selectedStatusInput.value = ''; // リセット
        document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
        reasonGroup.style.display = 'none';
        longTermGroup.style.display = 'none';
        checkFormValidity();
    });

    // 状況ボタンの切り替え
    const statusBtns = document.querySelectorAll('.status-btn');
    const reasonLabel = document.getElementById('reason-label');
    const longTermGroup = document.getElementById('future-date-group');
    const dateRangeArea = document.getElementById('future-date-range');
    const dateSingleArea = document.getElementById('future-date-single');
    const longTermStart = document.getElementById('long-term-start');
    const longTermEnd = document.getElementById('long-term-end');
    const singleDate = document.getElementById('single-date');

    statusBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 同じカテゴリー内のボタンだけactiveを管理する（今回は全体で管理してもOKだが、表示中のみにする）
            document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedStatusInput.value = btn.dataset.status;
            
            if (currentCategory === 'future') {
                reasonGroup.style.display = 'block';
                reasonLabel.innerHTML = '理由・詳細 <span style="color:red; font-size:0.85em;">(必須)</span>';
                longTermGroup.style.display = 'block';
                
                if (btn.dataset.status === '長期休暇') {
                    dateRangeArea.style.display = 'flex';
                    dateSingleArea.style.display = 'none';
                } else {
                    dateRangeArea.style.display = 'none';
                    dateSingleArea.style.display = 'block';
                }
            } else {
                longTermGroup.style.display = 'none';
                
                if (btn.dataset.status === '欠席' || btn.dataset.status === '遅刻' || btn.dataset.status === '一時外出') {
                    reasonGroup.style.display = 'block';
                    reasonLabel.innerHTML = btn.dataset.status === '一時外出' ? '用件／行先 <span style="color:red; font-size:0.85em;">(必須)</span>' : '理由・詳細 <span style="color:red; font-size:0.85em;">(必須)</span>';
                } else {
                    reasonGroup.style.display = 'none';
                }
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
    singleDate.addEventListener('input', checkFormValidity);

    function checkFormValidity() {
        const member = memberSelect.value;
        const status = selectedStatusInput.value;
        const reason = reasonInput.value.trim();

        let isValid = (member && status);
        
        if (currentCategory === 'future') {
            if (reason === '') isValid = false;
            
            if (status === '長期休暇') {
                if (!longTermStart.value || !longTermEnd.value) isValid = false;
                if (new Date(longTermStart.value) > new Date(longTermEnd.value)) isValid = false;
            } else if (status === '事前の欠席' || status === '事前の遅刻') {
                if (!singleDate.value) isValid = false;
            }
        } else {
            if ((status === '欠席' || status === '遅刻' || status === '一時外出') && reason === '') {
                isValid = false;
            }
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
        const newStatus = selectedStatusInput.value;
        let reason = reasonInput.value.trim();

        if (currentCategory === 'future') {
            let startDate, endDate;
            let finalType = newStatus;

            if (newStatus === '長期休暇') {
                startDate = longTermStart.value;
                endDate = longTermEnd.value;
            } else {
                startDate = singleDate.value;
                endDate = singleDate.value;
            }

            socket.emit('submitFutureEvent', { id, type: finalType, startDate, endDate, reason }, (response) => {
                submitBtn.textContent = '更新する';
                if (response.success) {
                    showAlert('成功', `${response.name}さんの予定(${startDate}〜)を登録しました。`, 'success');
                    reasonInput.value = '';
                    longTermStart.value = '';
                    longTermEnd.value = '';
                    singleDate.value = '';
                    checkFormValidity();
                    setTimeout(() => window.location.href = 'board.html', 1500);
                } else {
                    showAlert('エラー', response.message, 'error');
                    submitBtn.removeAttribute('disabled');
                }
            });
            return;
        }

        const newLocation = locationSelect.value;
        reason = (newStatus === '欠席' || newStatus === '遅刻' || newStatus === '一時外出') ? reasonInput.value.trim() : '';

        // Socket経由で通常ステータス更新を送信
        const password = ""; // パスワードは撤廃
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

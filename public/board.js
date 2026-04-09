const globalSocket = io();

// サーバーからの強制リロード命令
globalSocket.on('forceReload', () => {
    window.location.reload();
});

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const gridContainer = document.getElementById('members-grid');

    // 時計の更新
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ja-JP', { hour12: false });
        document.getElementById('clock').textContent = timeString;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // メンバーリストの初回取得と描画
    fetch('/api/members')
        .then(response => response.json())
        .then(members => {
            const targetTeam = window.currentTeamView || 'ALL';
            gridContainer.innerHTML = ''; // Loadingテキストを消す
            members.forEach(member => {
                const mTeam = member.team || '共通';
                if (targetTeam === 'ALL' || targetTeam === mTeam) {
                    const card = createMemberCard(member);
                    gridContainer.appendChild(card);
                }
            });
        })
        .catch(err => {
            gridContainer.innerHTML = '<div class="alert error">データの読み込みに失敗しました。リロードしてください。</div>';
        });

    // カードのHTML要素を生成
    function createMemberCard(member) {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.id = `member-${member.id}`;
        card.setAttribute('data-status', member.status);

        const updateTimeDisplay = member.lastUpdate ? `${member.lastUpdate} 更新` : '更新履歴なし';
        const attendDisplay = member.attendTime || '-';
        const leaveDisplay = member.leaveTime || '-';

        const showReason = (member.status === '欠席' || member.status === '遅刻' || member.status === '一時外出') && member.reason;
        const reasonHtml = showReason 
            ? `<div class="member-reason" style="font-size:0.85rem; color:#d97706; margin-top:5px; margin-bottom:12px; padding:8px 10px; background:#fef3c7; border-radius:6px; text-align:left; line-height:1.5; word-break:break-word; display:flex; gap:6px;">
                 <span class="reason-label" style="font-weight:bold; flex-shrink:0;">${member.status === '一時外出' ? '用件/行先:' : '理由:'}</span>
                 <span class="reason-text" style="flex-grow:1;">${member.reason}</span>
               </div>` 
            : `<div class="member-reason" style="display:none; font-size:0.85rem; color:#d97706; margin-top:5px; margin-bottom:12px; padding:8px 10px; background:#fef3c7; border-radius:6px; text-align:left; line-height:1.5; word-break:break-word; display:flex; gap:6px;">
                 <span class="reason-label" style="font-weight:bold; flex-shrink:0;"></span>
                 <span class="reason-text" style="flex-grow:1;"></span>
               </div>`;

        card.innerHTML = `
            <div class="member-info" style="margin-bottom: 8px;">
                <div class="member-name">${member.name}</div>
                <div class="member-status-group">
                    <div class="member-status">${member.status}</div>
                    <div class="member-location">📍 ${member.location}</div>
                </div>
            </div>
            ${reasonHtml}
            <div style="font-size: 0.85rem; color: #555; margin-top: auto; padding-top: 8px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-weight: bold;">
                <span class="member-attend">出席: ${attendDisplay}</span>
                <span class="member-leave">退席: ${leaveDisplay}</span>
            </div>
            <div class="member-update" id="update-time-${member.id}">${updateTimeDisplay}</div>
        `;

        return card;
    }

    // Socket: 誰かのステータスが更新された時のイベント
    socket.on('statusChanged', (member) => {
        const targetTeam = window.currentTeamView || 'ALL';
        const mTeam = member.team || '共通';
        
        const card = document.getElementById(`member-${member.id}`);
        if (card) {
            // UI更新
            card.setAttribute('data-status', member.status);
            card.querySelector('.member-status').textContent = member.status;
            card.querySelector('.member-location').textContent = `📍 ${member.location}`;
            card.querySelector('.member-update').textContent = `${member.lastUpdate} 更新`;
            
            card.querySelector('.member-attend').textContent = `出席: ${member.attendTime || '-'}`;
            card.querySelector('.member-leave').textContent = `退席: ${member.leaveTime || '-'}`;

            // 理由の表示更新
            const reasonEl = card.querySelector('.member-reason');
            if (reasonEl) {
                if ((member.status === '欠席' || member.status === '遅刻' || member.status === '一時外出') && member.reason) {
                    reasonEl.style.display = 'flex';
                    reasonEl.querySelector('.reason-label').textContent = member.status === '一時外出' ? '用件/行先:' : '理由:';
                    reasonEl.querySelector('.reason-text').textContent = member.reason;
                } else {
                    reasonEl.style.display = 'none';
                    reasonEl.querySelector('.reason-text').textContent = '';
                }
            }

            // アニメーションを再適用（一度外して付け直す）
            card.classList.remove('highlight');
            void card.offsetWidth; // リフロー強制
            card.classList.add('highlight');
            
            // チーム変更でフィルタ外になった場合は隠す・現れた場合はリロード
            if (targetTeam !== 'ALL' && targetTeam !== mTeam) {
                card.style.display = 'none';
            } else {
                card.style.display = 'flex'; // またはblock
            }
        } else {
            // 新規メンバーかもしれないし、チーム変更で対象に入っただけかもしれないのでリロードさせる
            if (targetTeam === 'ALL' || targetTeam === mTeam) {
                location.reload();
            }
        }
    });

    // メンバーリスト自体が変更されたら全リロード
    socket.on('memberListUpdated', () => {
        location.reload();
    });
});

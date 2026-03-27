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
            gridContainer.innerHTML = ''; // Loadingテキストを消す
            members.forEach(member => {
                const card = createMemberCard(member);
                gridContainer.appendChild(card);
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

        card.innerHTML = `
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-status-group">
                    <div class="member-status">${member.status}</div>
                    <div class="member-location">📍 ${member.location}</div>
                </div>
            </div>
            <div style="font-size: 0.85rem; color: #555; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-weight: bold;">
                <span class="member-attend">登: ${attendDisplay}</span>
                <span class="member-leave">退: ${leaveDisplay}</span>
            </div>
            <div class="member-update" id="update-time-${member.id}">${updateTimeDisplay}</div>
        `;

        return card;
    }

    // Socket: 誰かのステータスが更新された時のイベント
    socket.on('statusChanged', (member) => {
        const card = document.getElementById(`member-${member.id}`);
        if (card) {
            // UI更新
            card.setAttribute('data-status', member.status);
            card.querySelector('.member-status').textContent = member.status;
            card.querySelector('.member-location').textContent = `📍 ${member.location}`;
            card.querySelector('.member-update').textContent = `${member.lastUpdate} 更新`;
            
            card.querySelector('.member-attend').textContent = `登: ${member.attendTime || '-'}`;
            card.querySelector('.member-leave').textContent = `退: ${member.leaveTime || '-'}`;

            // アニメーションを再適用（一度外して付け直す）
            card.classList.remove('highlight');
            void card.offsetWidth; // リフロー強制
            card.classList.add('highlight');
        } else {
            // 新規メンバーかもしれないのでリロードさせる
            location.reload();
        }
    });

    // メンバーリスト自体が変更されたら全リロード
    socket.on('memberListUpdated', () => {
        location.reload();
    });
});

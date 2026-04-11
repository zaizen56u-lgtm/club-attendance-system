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

    let membersList = [];
    let allTasks = [];

    // メンバーリストの初回取得
    fetch('/api/members')
        .then(response => response.json())
        .then(members => {
            membersList = members;
            fetchTasks(); // メンバー取得後にタスクを取得
        })
        .catch(err => {
            gridContainer.innerHTML = '<div class="alert error">データの読み込みに失敗しました。リロードしてください。</div>';
        });

    function fetchTasks() {
        socket.emit('getTasks', null, (res) => {
            if (res.success) {
                allTasks = res.tasks;
                renderBoard();
            }
        });
    }

    socket.on('tasksUpdated', (newTasks) => {
        allTasks = newTasks;
        renderBoard();
    });

    function renderBoard() {
        gridContainer.innerHTML = '';
        const targetTeam = window.currentTeamView || 'ALL';
        
        let displayTasks = allTasks.filter(task => {
            const assignee = membersList.find(m => m.id === task.assigneeId);
            const mTeam = assignee ? (assignee.team || '共通') : '共通';
            return (targetTeam === 'ALL' || targetTeam === mTeam);
        });

        if (displayTasks.length === 0) {
            gridContainer.innerHTML = '<div style="text-align:center; color:#6b7280; grid-column: 1 / -1; padding: 30px;">現在表示できるタスクはありません。</div>';
            return;
        }

        // 未完了優先、最新順ソート
        displayTasks.sort((a,b) => {
            if(a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        displayTasks.forEach(task => {
            const assigneeInfo = membersList.find(m => m.id === task.assigneeId);
            const assignerInfo = membersList.find(m => m.id === task.assignerId);
            const statusText = task.isCompleted ? "完了" : "実施中";
            
            const card = document.createElement('div');
            card.className = 'member-card';
            card.setAttribute('data-status', statusText);
            
            let html = `
                <div class="member-name" style="font-size: 1.05rem; margin-bottom: 5px; word-break: break-all;">${task.title}</div>
                <div class="member-status">${statusText}</div>
                <div class="member-time" style="font-size: 0.75rem; margin-bottom: 5px; color: #6b7280; text-align: center;">
                    作: ${assignerInfo ? assignerInfo.name : '不明'}<br>
                    宛: ${assigneeInfo ? assigneeInfo.name : '不明'}
                </div>
            `;
            
            if (task.desc) {
                html += `<div style="font-size: 0.8rem; padding: 6px; background: #f9fafb; border-radius: 4px; margin-bottom: 8px; text-align: left; word-break: break-all; color: #4b5563;">${task.desc}</div>`;
            }
            
            card.innerHTML = html;
            gridContainer.appendChild(card);
        });
    }
});

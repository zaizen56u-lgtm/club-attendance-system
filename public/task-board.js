const globalSocket = io();

// サーバーからの強制リロード命令
globalSocket.on('forceReload', () => {
    window.location.reload();
});

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const loadingMsg = document.getElementById('task-list-loading');
    const emptyMsg = document.getElementById('task-list-empty');
    const boardTeam = document.getElementById('board-team');
    const boardOverall = document.getElementById('board-overall');
    const boardManager = document.getElementById('board-manager');
    const gridTeam = document.getElementById('grid-team');
    const gridOverall = document.getElementById('grid-overall');
    const gridManager = document.getElementById('grid-manager');

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
            if(loadingMsg) loadingMsg.innerHTML = '<div class="alert error">データの読み込みに失敗しました。リロードしてください。</div>';
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
        if(loadingMsg) loadingMsg.style.display = 'none';
        gridTeam.innerHTML = '';
        gridOverall.innerHTML = '';
        gridManager.innerHTML = '';
        
        const targetTeam = window.currentTeamView || 'ALL';
        
        let displayTasks = allTasks.filter(task => {
            const assignee = membersList.find(m => m.id === task.assigneeId);
            const mTeam = assignee ? (assignee.team || '共通') : '共通';
            return (targetTeam === 'ALL' || targetTeam === mTeam);
        });

        if (displayTasks.length === 0) {
            emptyMsg.style.display = 'block';
            boardTeam.style.display = 'none';
            boardOverall.style.display = 'none';
            boardManager.style.display = 'none';
            return;
        } else {
            emptyMsg.style.display = 'none';
            boardTeam.style.display = 'block';
            boardOverall.style.display = 'block';
            boardManager.style.display = 'block';
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
                <div class="member-name" style="font-size: 1.25rem; font-weight: bold; margin-bottom: 8px; word-break: break-all;">${task.title}</div>
                <div class="member-status" style="font-size: 1rem; padding: 6px;">${statusText}</div>
                <div class="member-time" style="font-size: 0.95rem; margin-bottom: 10px; color: #6b7280; text-align: center; line-height: 1.4;">
                    作成: ${assignerInfo ? assignerInfo.name : '不明'}<br>
                    宛先: ${assigneeInfo ? assigneeInfo.name : '不明'}
                </div>
            `;
            
            if (task.desc) {
                html += `<div style="font-size: 1rem; line-height: 1.5; padding: 10px; background: #f9fafb; border-radius: 6px; margin-bottom: 15px; text-align: left; word-break: break-all; color: #4b5563;">${task.desc}</div>`;
            }
            
            card.innerHTML = html;
            
            if (task.category === '各チームのタスク') gridTeam.appendChild(card);
            else if (task.category === '部全体のタスク') gridOverall.appendChild(card);
            else if (task.category === 'マネージャーのタスク') gridManager.appendChild(card);
            else gridTeam.appendChild(card);
        });
        
        if (gridTeam.children.length === 0) boardTeam.style.display = 'none';
        if (gridOverall.children.length === 0) boardOverall.style.display = 'none';
        if (gridManager.children.length === 0) boardManager.style.display = 'none';
    }
});

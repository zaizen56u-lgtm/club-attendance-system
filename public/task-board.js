const globalSocket = io();

// サーバーからの強制リロード命令
globalSocket.on('forceReload', () => {
    window.location.reload();
});

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const loadingMsg = document.getElementById('task-list-loading');
    const emptyMsg = document.getElementById('task-list-empty');
    const boardTeamA = document.getElementById('board-team-a');
    const boardTeamB = document.getElementById('board-team-b');
    const boardOverall = document.getElementById('board-overall');
    const boardManager = document.getElementById('board-manager');
    const gridTeamA = document.getElementById('grid-team-a');
    const gridTeamB = document.getElementById('grid-team-b');
    const gridOverall = document.getElementById('grid-overall');
    const gridManager = document.getElementById('grid-manager');
    const categoryTabs = document.querySelectorAll('.tab-btn');
    
    let currentCategoryView = 'ALL';
    let membersList = [];
    let allTasks = [];

    // 時計の更新
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ja-JP', { hour12: false });
        document.getElementById('clock').textContent = timeString;
    }
    setInterval(updateClock, 1000);
    updateClock();

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
            } else {
                if(loadingMsg) loadingMsg.textContent = 'タスクの取得に失敗しました';
            }
        });
    }

    // Tabs functionality
    if (categoryTabs) {
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                categoryTabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.background = '#E5E7EB';
                    t.style.color = '#374151';
                });
                tab.classList.add('active');
                tab.style.background = '#4F46E5';
                tab.style.color = 'white';
                
                currentCategoryView = tab.getAttribute('data-target');
                renderBoard();
            });
        });
    }

    socket.on('tasksUpdated', (newTasks) => {
        allTasks = newTasks;
        renderBoard();
    });

    function renderBoard() {
        if(loadingMsg) loadingMsg.style.display = 'none';
        if(gridTeamA) gridTeamA.innerHTML = '';
        if(gridTeamB) gridTeamB.innerHTML = '';
        if(gridOverall) gridOverall.innerHTML = '';
        if(gridManager) gridManager.innerHTML = '';
        
        let displayTasks = [...allTasks];

        if (displayTasks.length === 0) {
            emptyMsg.style.display = 'block';
            if(boardTeamA) boardTeamA.style.display = 'none';
            if(boardTeamB) boardTeamB.style.display = 'none';
            if(boardOverall) boardOverall.style.display = 'none';
            if(boardManager) boardManager.style.display = 'none';
            return;
        } else {
            emptyMsg.style.display = 'none';
            if(boardTeamA) boardTeamA.style.display = 'block';
            if(boardTeamB) boardTeamB.style.display = 'block';
            if(boardOverall) boardOverall.style.display = 'block';
            if(boardManager) boardManager.style.display = 'block';
        }

        // 未完了優先、最新順ソート
        displayTasks.sort((a,b) => {
            if(a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const TASK_LIMIT = 3;
        const uncompletedCountMap = {};
        allTasks.forEach(t => {
            if (!t.isCompleted) {
                uncompletedCountMap[t.assigneeId] = (uncompletedCountMap[t.assigneeId] || 0) + 1;
            }
        });

        displayTasks.forEach(task => {
            const assigneeInfo = membersList.find(m => m.id === task.assigneeId);
            const assignerInfo = membersList.find(m => m.id === task.assignerId);
            
            let progress = task.progress || 0;
            let progressText = progress === 100 ? "完了" : "進捗: " + progress + "%";
            
            const assigneeName = assigneeInfo ? assigneeInfo.name : '不明';
            let warningBadge = '';
            if (progress < 100 && uncompletedCountMap[task.assigneeId] >= TASK_LIMIT) {
                warningBadge = `<span style="color:#EF4444; font-weight:bold; font-size:0.8rem; padding:2px 4px; background:#FEE2E2; border-radius:4px; margin-left:8px; vertical-align:middle; border:1px solid #FCA5A5;">⚠️タスク過多</span>`;
            }
            
            const card = document.createElement('div');
            card.className = 'member-card';
            
            let deadlineHtml = "";
            let isExpired = false;
            if (task.deadline) {
                const dlDate = new Date(task.deadline);
                isExpired = dlDate < new Date() && progress < 100;
                const dlStyle = isExpired ? 'color: #EF4444; font-weight: bold;' : 'color: #6b7280;';
                deadlineHtml = `<div style="font-size: 0.85rem; margin-top: 5px; text-align: center; ${dlStyle}">⏰ 期限: ${task.deadline.replace('T', ' ')} ${isExpired ? '(超過)' : ''}</div>`;
            }

            const borderColor = progress === 100 ? '#10B981' : (isExpired ? '#EF4444' : '#F59E0B');
            card.style.borderLeftColor = borderColor;
            
            let html = `
                <div class="member-name" style="font-size: 1.25rem; font-weight: bold; margin-bottom: 8px; word-break: break-all;">${task.title}</div>
                <div class="member-status" style="font-size: 1rem; padding: 6px; background-color: ${borderColor}; color: white; border: none;">${progressText}</div>
                <div class="member-time" style="font-size: 0.95rem; margin-top: 10px; margin-bottom: 5px; color: #6b7280; text-align: center; line-height: 1.4;">
                    作成: ${assignerInfo ? assignerInfo.name : '不明'}<br>
                    宛先: ${assigneeName} ${warningBadge}
                </div>
                ${deadlineHtml}
                
                <div style="width: 100%; background: #E5E7EB; border-radius: 4px; overflow: hidden; height: 6px; margin-top: 10px; margin-bottom: 10px;">
                    <div style="width: ${progress}%; background: ${borderColor}; height: 100%; transition: width 0.3s;"></div>
                </div>
            `;
            
            if (task.desc) {
                html += `<div style="font-size: 1rem; line-height: 1.5; padding: 10px; background: #f9fafb; border-radius: 6px; margin-bottom: 15px; text-align: left; word-break: break-all; color: #4b5563;">${task.desc}</div>`;
            }
            
            card.innerHTML = html;
            
            if (task.category === 'Aチームのタスク' || task.category === '各チームのタスク') {
                if(gridTeamA) gridTeamA.appendChild(card);
            } else if (task.category === 'Bチームのタスク') {
                if(gridTeamB) gridTeamB.appendChild(card);
            } else if (task.category === '部全体のタスク') {
                if(gridOverall) gridOverall.appendChild(card);
            } else if (task.category === 'マネージャーのタスク') {
                if(gridManager) gridManager.appendChild(card);
            } else {
                if(gridOverall) gridOverall.appendChild(card); // fallback
            }
        });
        
        // Ensure visibility defaults to block if tasks exist
        if (gridTeamA && gridTeamA.children.length > 0 && boardTeamA) boardTeamA.style.display = 'block';
        if (gridTeamB && gridTeamB.children.length > 0 && boardTeamB) boardTeamB.style.display = 'block';
        if (gridOverall && gridOverall.children.length > 0 && boardOverall) boardOverall.style.display = 'block';
        if (gridManager && gridManager.children.length > 0 && boardManager) boardManager.style.display = 'block';
        
        // Hide if empty
        if (gridTeamA && gridTeamA.children.length === 0 && boardTeamA) boardTeamA.style.display = 'none';
        if (gridTeamB && gridTeamB.children.length === 0 && boardTeamB) boardTeamB.style.display = 'none';
        if (gridOverall && gridOverall.children.length === 0 && boardOverall) boardOverall.style.display = 'none';
        if (gridManager && gridManager.children.length === 0 && boardManager) boardManager.style.display = 'none';
        
        // Apply tab filters
        if (currentCategoryView !== 'ALL') {
            if (boardTeamA) boardTeamA.style.display = (currentCategoryView === 'TEAM_A' && gridTeamA.children.length > 0) ? 'block' : 'none';
            if (boardTeamB) boardTeamB.style.display = (currentCategoryView === 'TEAM_B' && gridTeamB.children.length > 0) ? 'block' : 'none';
            if (boardOverall) boardOverall.style.display = (currentCategoryView === 'OVERALL' && gridOverall.children.length > 0) ? 'block' : 'none';
            if (boardManager) boardManager.style.display = (currentCategoryView === 'MANAGER' && gridManager.children.length > 0) ? 'block' : 'none';
            
            // Check if entirely empty for the selected tab
            const visibleCount = Array.from(document.querySelectorAll('.members-grid.category-grid')).reduce((sum, el) => {
                return sum + ((el.parentElement.style.display !== 'none') ? el.children.length : 0);
            }, 0);
            
            if (visibleCount === 0) {
                emptyMsg.style.display = 'block';
                emptyMsg.textContent = '現在表示できるタスクはありません。';
            } else {
                emptyMsg.style.display = 'none';
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    const memberSelect = document.getElementById('member-select');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('login-error');
    
    const loginSection = document.getElementById('login-section');
    const taskSection = document.getElementById('task-section');
    const leaderTools = document.getElementById('leader-tools');
    const assigneeSelect = document.getElementById('assignee-select');
    const dashboardName = document.getElementById('dashboard-name');
    const taskListContainer = document.getElementById('task-list-container');
    
    let membersList = [];
    let currentUser = null; // { id, name, team, password }
    
    // Initial Fetch
    fetch('/api/members')
        .then(res => res.json())
        .then(members => {
            membersList = members;
            // Populate login select
            members.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                memberSelect.appendChild(opt);
            });
        });
        
    document.getElementById('login-btn').addEventListener('click', () => {
        const id = memberSelect.value;
        const pw = passwordInput.value;
        
        if(!id || !pw) return;
        
        socket.emit('verifyTaskUser', { id: id, password: pw }, (res) => {
            if (res.success) {
                loginError.style.display = 'none';
                currentUser = { ...res.member, password: pw }; // store password for future operations
                setupDashboard();
            } else {
                loginError.style.display = 'block';
            }
        });
    });
    
    function setupDashboard() {
        loginSection.style.display = 'none';
        taskSection.style.display = 'block';
        dashboardName.textContent = currentUser.name;
        
        const isLeader = (currentUser.id === 7 || currentUser.id === 12);
        
        if (isLeader) {
            leaderTools.style.display = 'block';
            populateAssigneeSelect();
        }
        
        fetchTasks();
    }
    
    function populateAssigneeSelect() {
        assigneeSelect.innerHTML = '<option value="">-- メンバーを選択 --</option>';
        // 吉村(12)はAチーム、桑原(7)はBチームと推定。実際にはcurrentUser.teamを取得
        // currentUserが確実に自チームに紐づいている前提
        const leaderTeam = currentUser.team || '共通'; 
        
        membersList.forEach(m => {
            const mTeam = m.team || '共通';
            // 同じチームの部員のみ選択肢に入れる
            if (mTeam === leaderTeam && m.id !== currentUser.id) {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                assigneeSelect.appendChild(opt);
            }
        });
    }
    
    document.getElementById('add-task-btn').addEventListener('click', () => {
        const assigneeId = document.getElementById('assignee-select').value;
        const title = document.getElementById('task-title').value.trim();
        const desc = document.getElementById('task-desc').value.trim();
        
        if (!assigneeId || !title) {
            alert('メンバーとタスクタイトルを入力してください。');
            return;
        }
        
        socket.emit('addTask', {
            assignerId: currentUser.id,
            assigneeId: assigneeId,
            title: title,
            desc: desc,
            password: currentUser.password
        }, (res) => {
            if (res.success) {
                document.getElementById('task-title').value = '';
                document.getElementById('task-desc').value = '';
                alert('タスクを作成しました。');
            } else {
                alert(res.message);
            }
        });
    });
    
    function fetchTasks() {
        socket.emit('getTasks', null, (res) => {
            if (res.success) {
                renderTasks(res.tasks);
            }
        });
    }
    
    socket.on('tasksUpdated', (newTasks) => {
        if (currentUser) {
            renderTasks(newTasks);
        }
    });
    
    function renderTasks(allTasks) {
        taskListContainer.innerHTML = '';
        
        let displayTasks = [];
        const isLeader = (currentUser.id === 7 || currentUser.id === 12);
        
        if (isLeader) {
            // リーダーは「自分が割り当てたタスク」と「自分に割り当てられたタスク」を見れる
            displayTasks = allTasks.filter(t => t.assignerId === currentUser.id || t.assigneeId === currentUser.id);
        } else {
            // 普通のメンバーは「自分に割り当てられたタスク」のみ見れる
            displayTasks = allTasks.filter(t => t.assigneeId === currentUser.id);
        }
        
        if (displayTasks.length === 0) {
            taskListContainer.innerHTML = '<div style="text-align:center; color:#6b7280; padding:20px;">現在表示できるタスクはありません。</div>';
            return;
        }
        
        // 未完了優先、最新順ソート
        displayTasks.sort((a,b) => {
            if(a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        displayTasks.forEach(task => {
            const isAssignedToMe = task.assigneeId === currentUser.id;
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
            
            html += `<div style="display: flex; flex-direction: column; gap: 5px; margin-top: auto;">`;
            
            if (isAssignedToMe && !task.isCompleted) {
                html += `<button class="submit-btn task-action-btn mark-complete-btn" data-id="${task.id}" style="background:#10b981;">✅ 完了</button>`;
            }
            if (isAssignedToMe && task.isCompleted) {
                html += `<button class="submit-btn task-action-btn mark-incomplete-btn" data-id="${task.id}" style="background:#6b7280;">🔄 戻す</button>`;
            }
            if (isLeader && task.assignerId === currentUser.id) {
                html += `<button class="submit-btn task-action-btn delete-task-btn" data-id="${task.id}" style="background:#ef4444;">🗑️ 削除</button>`;
            }
            
            html += `</div>`;
            card.innerHTML = html;
            taskListContainer.appendChild(card);
        });
        
        // Events
        document.querySelectorAll('.mark-complete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => toggleStatus(e.target.getAttribute('data-id'), true));
        });
        document.querySelectorAll('.mark-incomplete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => toggleStatus(e.target.getAttribute('data-id'), false));
        });
        document.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(confirm('このタスクを削除しますか？')) {
                    socket.emit('deleteTask', {
                        taskId: e.target.getAttribute('data-id'),
                        memberId: currentUser.id,
                        password: currentUser.password
                    }, (res) => { if(!res.success) alert(res.message); });
                }
            });
        });
    }
    
    function toggleStatus(taskId, status) {
        socket.emit('updateTaskStatus', {
            taskId: taskId,
            isCompleted: status,
            memberId: currentUser.id,
            password: currentUser.password
        }, (res) => {
            if(!res.success) alert(res.message);
        });
    }
});

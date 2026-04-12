document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    const loginMembersGrid = document.getElementById('login-members-grid');
    
    // Portal buttons
    const portalSection = document.getElementById('portal-section');
    const gotoBoardBtn = document.getElementById('goto-board-btn');
    const gotoPersonalBtn = document.getElementById('goto-personal-btn');
    
    if (gotoBoardBtn) {
        gotoBoardBtn.addEventListener('click', () => {
            window.location.href = 'task-board.html';
        });
    }
    
    if (gotoPersonalBtn) {
        gotoPersonalBtn.addEventListener('click', () => {
            portalSection.style.display = 'none';
            loginSection.style.display = 'block';
        });
    }
    
    let selectedUserId = null;
    
    const loginSection = document.getElementById('login-section');
    const taskSection = document.getElementById('task-section');
    const leaderTools = document.getElementById('leader-tools');
    const assigneeCheckboxes = document.getElementById('assignee-checkboxes');
    const taskCategorySelect = document.getElementById('task-category-select');
    const dashboardName = document.getElementById('dashboard-name');
    const taskListContainer = document.getElementById('task-list-container');
    
    let membersList = [];
    let currentUser = null; // { id, name, team, password }
    
    // Initial Fetch
    fetch('/api/members')
        .then(res => res.json())
        .then(members => {
            membersList = members;
            // Populate grid
            members.forEach(m => {
                const card = document.createElement('div');
                card.style.padding = '12px 8px';
                card.style.background = '#ffffff';
                card.style.border = '1px solid #e2e8f0';
                card.style.borderRadius = '10px';
                card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                card.style.textAlign = 'center';
                card.style.cursor = 'pointer';
                card.style.fontWeight = '600';
                card.style.fontSize = '1.05rem';
                card.style.color = '#1e293b';
                card.style.transition = 'all 0.2s';
                card.style.display = 'flex';
                card.style.alignItems = 'center';
                card.style.justifyContent = 'center';
                card.style.minHeight = '55px';
                
                card.innerHTML = `${m.name}`;
                
                card.addEventListener('mouseover', () => { 
                    card.style.transform = 'translateY(-2px)';
                    card.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)';
                    card.style.borderColor = '#94a3b8';
                    card.style.color = '#2563eb';
                });
                card.addEventListener('mouseout', () => { 
                    card.style.transform = 'none';
                    card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                    card.style.borderColor = '#e2e8f0';
                    card.style.color = '#1e293b';
                });
                
                card.addEventListener('click', () => {
                    // 全員パスワードなしでログイン
                    selectedUserId = m.id;
                    socket.emit('verifyTaskUser', { id: m.id, password: "" }, (res) => {
                        if (res.success) {
                            currentUser = { ...res.member, password: "" };
                            setupDashboard();
                        } else {
                            alert(res.message);
                        }
                    });
                });
                loginMembersGrid.appendChild(card);
            });
        });
        

    
    function setupDashboard() {
        loginSection.style.display = 'none';
        taskSection.style.display = 'block';
        dashboardName.textContent = currentUser.name;
        
        const isLeader = currentUser.canAssignTasks === true;
        
        if (isLeader) {
            leaderTools.style.display = 'block';
            populateAssigneeCheckboxes();
        }
        
        fetchTasks();
    }
    
    function populateAssigneeCheckboxes() {
        assigneeCheckboxes.innerHTML = '';
        
        membersList.forEach(m => {
            // 部内の誰でも（自分以外）を選択可能にする
            if (m.id !== currentUser.id) {
                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.marginBottom = '5px';
                label.style.cursor = 'pointer';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = m.id;
                cb.className = 'assignee-cb';
                cb.style.marginRight = '8px';
                label.appendChild(cb);
                label.appendChild(document.createTextNode(m.name));
                assigneeCheckboxes.appendChild(label);
            }
        });
    }
    
    document.getElementById('add-task-btn').addEventListener('click', () => {
        const checkedCbs = Array.from(document.querySelectorAll('.assignee-cb:checked'));
        const assigneeIds = checkedCbs.map(cb => cb.value);
        const category = taskCategorySelect.value;
        const title = document.getElementById('task-title').value.trim();
        const desc = document.getElementById('task-desc').value.trim();
        const authPassword = document.getElementById('assign-task-password').value;
        
        if (assigneeIds.length === 0 || !title) {
            alert('対象メンバーを1名以上選択し、タスクタイトルを入力してください。');
            return;
        }
        
        if (!authPassword) {
            alert('共通パスワードを入力してください。');
            return;
        }
        
        socket.emit('addTask', {
            assignerId: currentUser.id,
            assigneeIds: assigneeIds,
            category: category,
            title: title,
            desc: desc,
            password: authPassword
        }, (res) => {
            if (res.success) {
                document.getElementById('task-title').value = '';
                document.getElementById('task-desc').value = '';
                document.getElementById('assign-task-password').value = '';
                document.querySelectorAll('.assignee-cb').forEach(cb => cb.checked = false);
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
        const taskListTeamA = document.querySelector('#task-list-team-a .category-grid');
        const taskListTeamB = document.querySelector('#task-list-team-b .category-grid');
        const taskListOverall = document.querySelector('#task-list-overall .category-grid');
        const taskListManager = document.querySelector('#task-list-manager .category-grid');
        const emptyMsg = document.getElementById('task-list-empty');
        const loadingMsg = document.getElementById('task-list-loading');
        
        if (loadingMsg) loadingMsg.style.display = 'none';
        if (taskListTeamA) taskListTeamA.innerHTML = '';
        if (taskListTeamB) taskListTeamB.innerHTML = '';
        if (taskListOverall) taskListOverall.innerHTML = '';
        if (taskListManager) taskListManager.innerHTML = '';
        
        const assignedTasksWrapper = document.getElementById('assigned-tasks-wrapper');
        const assignedTaskListContainer = document.getElementById('assigned-task-list-container');
        if (assignedTaskListContainer) assignedTaskListContainer.innerHTML = '';
        
        const isLeader = currentUser.canAssignTasks === true;
        
        // My explicit Tasks
        let myTasks = allTasks.filter(t => t.assigneeId === currentUser.id);
        
        // Tasks I assigned to others (Leaders only)
        let tasksIAssigned = isLeader ? allTasks.filter(t => t.assignerId === currentUser.id && t.assigneeId !== currentUser.id) : [];
        
        if (myTasks.length === 0) {
            if (emptyMsg) emptyMsg.style.display = 'block';
            document.getElementById('task-list-team-a').style.display = 'none';
            document.getElementById('task-list-team-b').style.display = 'none';
            document.getElementById('task-list-overall').style.display = 'none';
            document.getElementById('task-list-manager').style.display = 'none';
        } else {
            if (emptyMsg) emptyMsg.style.display = 'none';
            document.getElementById('task-list-team-a').style.display = 'block';
            document.getElementById('task-list-team-b').style.display = 'block';
            document.getElementById('task-list-overall').style.display = 'block';
            document.getElementById('task-list-manager').style.display = 'block';
        }
        
        if (isLeader) {
            assignedTasksWrapper.style.display = 'block';
            if (tasksIAssigned.length === 0) {
                assignedTaskListContainer.innerHTML = '<div style="text-align:center; color:#6b7280; padding:20px; grid-column: 1 / -1;">現在振り分けたタスクはありません。</div>';
            } else {
                assignedTaskListContainer.innerHTML = `
                    <div class="task-category-section" style="margin-bottom:20px;">
                        <h3 style="font-size: 1.1rem; color: #4F46E5; margin-bottom: 10px;">📋 Aチームのタスク</h3>
                        <div id="assigned-team-a" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;"></div>
                    </div>
                    <div class="task-category-section" style="margin-bottom:20px;">
                        <h3 style="font-size: 1.1rem; color: #3B82F6; margin-bottom: 10px;">📋 Bチームのタスク</h3>
                        <div id="assigned-team-b" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;"></div>
                    </div>
                    <div class="task-category-section" style="margin-bottom:20px;">
                        <h3 style="font-size: 1.1rem; color: #10B981; margin-bottom: 10px;">🌐 部全体のタスク</h3>
                        <div id="assigned-overall" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;"></div>
                    </div>
                    <div class="task-category-section">
                        <h3 style="font-size: 1.1rem; color: #F59E0B; margin-bottom: 10px;">👔 マネージャーのタスク</h3>
                        <div id="assigned-manager" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;"></div>
                    </div>
                `;
            }
        } else {
            if (assignedTasksWrapper) assignedTasksWrapper.style.display = 'none';
        }
        
        // Sorting helper
        const sortTasks = (tasks) => tasks.sort((a,b) => {
            if(a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const appendTaskToContainer = (task, container, showDeleteInfo = false) => {
            const isAssignedToMe = task.assigneeId === currentUser.id;
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
            
            html += `<div style="display: flex; flex-direction: column; gap: 5px; margin-top: auto;">`;
            
            if (isAssignedToMe && !task.isCompleted) {
                html += `<button class="submit-btn task-action-btn mark-complete-btn" data-id="${task.id}" style="background:#10b981;">✅ 完了</button>`;
            }
            if (isAssignedToMe && task.isCompleted) {
                html += `<button class="submit-btn task-action-btn mark-incomplete-btn" data-id="${task.id}" style="background:#6b7280;">🔄 戻す</button>`;
            }
            if (showDeleteInfo && task.assignerId === currentUser.id) {
                html += `<button class="submit-btn task-action-btn delete-task-btn" data-id="${task.id}" style="background:#ef4444;">🗑️ 削除</button>`;
            }
            
            html += `</div>`;
            card.innerHTML = html;
            container.appendChild(card);
            
            // Re-attach handlers inline to be safe
            card.querySelectorAll('.mark-complete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => toggleStatus(e.target.getAttribute('data-id'), true));
            });
            card.querySelectorAll('.mark-incomplete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => toggleStatus(e.target.getAttribute('data-id'), false));
            });
            card.querySelectorAll('.delete-task-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const deletePass = prompt('タスク削除用パスワードを入力してください:');
                    if (!deletePass) return;
                    
                    if(confirm('このタスクを削除しますか？')) {
                        socket.emit('deleteTask', {
                            taskId: e.target.getAttribute('data-id'),
                            memberId: currentUser.id,
                            password: deletePass
                        }, (res) => { if(!res.success) alert(res.message); });
                    }
                });
            });
        };

        const routeTask = (task, isAssignedByMe) => {
            let targetGrid;
            if (isAssignedByMe) {
                if (!document.getElementById('assigned-team-a')) return; // No tasks assigned
                if (task.category === 'Aチームのタスク' || task.category === '各チームのタスク') targetGrid = document.getElementById('assigned-team-a');
                else if (task.category === 'Bチームのタスク') targetGrid = document.getElementById('assigned-team-b');
                else if (task.category === '部全体のタスク') targetGrid = document.getElementById('assigned-overall');
                else if (task.category === 'マネージャーのタスク') targetGrid = document.getElementById('assigned-manager');
                else targetGrid = document.getElementById('assigned-overall'); // Fallback
            } else {
                if (task.category === 'Aチームのタスク' || task.category === '各チームのタスク') targetGrid = taskListTeamA;
                else if (task.category === 'Bチームのタスク') targetGrid = taskListTeamB;
                else if (task.category === '部全体のタスク') targetGrid = taskListOverall;
                else if (task.category === 'マネージャーのタスク') targetGrid = taskListManager;
                else targetGrid = taskListOverall; // Fallback
            }
            appendTaskToContainer(task, targetGrid, isAssignedByMe);
        };

        sortTasks(myTasks).forEach(task => routeTask(task, false));
        if (isLeader) {
            sortTasks(tasksIAssigned).forEach(task => routeTask(task, true));
        }
        
        // Hide empty category sections in my tasks
        ['task-list-team-a', 'task-list-team-b', 'task-list-overall', 'task-list-manager'].forEach(id => {
            const wrap = document.getElementById(id);
            if (wrap && wrap.querySelector('.category-grid') && wrap.querySelector('.category-grid').children.length === 0) {
                wrap.style.display = 'none';
            }
        });
        
        if (isLeader && document.getElementById('assigned-team-a')) {
            [{id: 'assigned-team-a'}, {id: 'assigned-team-b'}, {id: 'assigned-overall'}, {id: 'assigned-manager'}].forEach(info => {
                const grid = document.getElementById(info.id);
                if (grid && grid.children.length === 0) {
                    grid.parentElement.style.display = 'none';
                }
            });
        }
    }
    
    function toggleStatus(taskId, status) {
        socket.emit('updateTaskStatus', {
            taskId: taskId,
            isCompleted: status,
            memberId: currentUser.id,
            password: "" // パスワード不要
        }, (res) => {
            if(!res.success) alert(res.message);
        });
    }
});

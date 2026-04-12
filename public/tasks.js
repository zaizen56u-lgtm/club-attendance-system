document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    const loginMembersGrid = document.getElementById('login-members-grid');
    
    // Portal buttons
    const portalSection = document.getElementById('portal-section');
    const gotoBoardBtn = document.getElementById('goto-board-btn');
    const gotoPersonalBtn = document.getElementById('goto-personal-btn');
    const gotoAssignBtn = document.getElementById('goto-assign-btn');
    
    if (gotoBoardBtn) {
        gotoBoardBtn.addEventListener('click', () => {
            window.location.href = 'task-board.html';
        });
    }
    
    if (gotoAssignBtn) {
        gotoAssignBtn.addEventListener('click', () => {
            window.location.href = 'task-assign.html';
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
        
        fetchTasks();
    }
    
    // Removed populateAssigneeCheckboxes and add-task-btn listener
    
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
        
        // My explicit Tasks
        let myTasks = allTasks.filter(t => t.assigneeId === currentUser.id);
        
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
        
        // Sorting helper
        const sortTasks = (tasks) => tasks.sort((a,b) => {
            if(a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const appendTaskToContainer = (task, container) => {
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
            
            if (!task.isCompleted) {
                html += `<button class="submit-btn task-action-btn mark-complete-btn" data-id="${task.id}" style="background:#10b981;">✅ 完了</button>`;
            }
            if (task.isCompleted) {
                html += `<button class="submit-btn task-action-btn mark-incomplete-btn" data-id="${task.id}" style="background:#6b7280;">🔄 戻す</button>`;
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
            // Removed delete-task-btn listener
        };

        const routeTask = (task) => {
            let targetGrid;
            if (task.category === 'Aチームのタスク' || task.category === '各チームのタスク') targetGrid = taskListTeamA;
            else if (task.category === 'Bチームのタスク') targetGrid = taskListTeamB;
            else if (task.category === '部全体のタスク') targetGrid = taskListOverall;
            else if (task.category === 'マネージャーのタスク') targetGrid = taskListManager;
            else targetGrid = taskListOverall; // Fallback
            appendTaskToContainer(task, targetGrid);
        };

        sortTasks(myTasks).forEach(task => routeTask(task));
        
        // Hide empty category sections in my tasks
        ['task-list-team-a', 'task-list-team-b', 'task-list-overall', 'task-list-manager'].forEach(id => {
            const wrap = document.getElementById(id);
            if (wrap && wrap.querySelector('.category-grid') && wrap.querySelector('.category-grid').children.length === 0) {
                wrap.style.display = 'none';
            }
        });
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

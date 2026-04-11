document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    const loginMembersGrid = document.getElementById('login-members-grid');
    const passwordModal = document.getElementById('password-modal');
    const modalUserName = document.getElementById('modal-user-name');
    const modalPassword = document.getElementById('modal-password');
    const modalError = document.getElementById('modal-error');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalLoginBtn = document.getElementById('modal-login-btn');
    
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
            // Populate grid
            members.forEach(m => {
                const card = document.createElement('div');
                card.style.padding = '15px';
                card.style.background = '#f9fafb';
                card.style.border = '1px solid #e5e7eb';
                card.style.borderRadius = '8px';
                card.style.textAlign = 'center';
                card.style.cursor = 'pointer';
                card.style.fontWeight = 'bold';
                card.style.color = '#374151';
                card.style.transition = 'background 0.2s, border-color 0.2s';
                
                card.textContent = m.name;
                
                card.addEventListener('mouseover', () => { card.style.background = '#e0e7ff'; card.style.borderColor = '#4f46e5'; });
                card.addEventListener('mouseout', () => { card.style.background = '#f9fafb'; card.style.borderColor = '#e5e7eb'; });
                
                card.addEventListener('click', () => {
                    const isLeader = (m.id === 7 || m.id === 12);
                    if (isLeader) {
                        selectedUserId = m.id;
                        modalUserName.textContent = m.name;
                        modalPassword.value = '';
                        modalError.style.display = 'none';
                        passwordModal.style.display = 'flex';
                        setTimeout(() => modalPassword.focus(), 100);
                    } else {
                        // Bypass password for normal members
                        socket.emit('verifyTaskUser', { id: m.id, password: "" }, (res) => {
                            if (res.success) {
                                currentUser = { ...res.member, password: "" };
                                setupDashboard();
                            } else {
                                alert(res.message);
                            }
                        });
                    }
                });
                loginMembersGrid.appendChild(card);
            });
        });
        
    modalCancelBtn.addEventListener('click', () => {
        passwordModal.style.display = 'none';
        selectedUserId = null;
    });
    
    modalLoginBtn.addEventListener('click', () => {
        const id = selectedUserId;
        const pw = modalPassword.value;
        
        if(!id || !pw) return;
        
        socket.emit('verifyTaskUser', { id: id, password: pw }, (res) => {
            if (res.success) {
                modalError.style.display = 'none';
                passwordModal.style.display = 'none';
                currentUser = { ...res.member, password: pw };
                setupDashboard();
            } else {
                modalError.style.display = 'block';
            }
        });
    });
    
    modalPassword.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            modalLoginBtn.click();
        }
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
        
        const assignedTasksWrapper = document.getElementById('assigned-tasks-wrapper');
        const assignedTaskListContainer = document.getElementById('assigned-task-list-container');
        if (assignedTaskListContainer) assignedTaskListContainer.innerHTML = '';
        
        const isLeader = (currentUser.id === 7 || currentUser.id === 12);
        
        // My explicit Tasks
        let myTasks = allTasks.filter(t => t.assigneeId === currentUser.id);
        
        // Tasks I assigned to others (Leaders only)
        let tasksIAssigned = isLeader ? allTasks.filter(t => t.assignerId === currentUser.id && t.assigneeId !== currentUser.id) : [];
        
        if (myTasks.length === 0) {
            taskListContainer.innerHTML = '<div style="text-align:center; color:#6b7280; padding:20px; grid-column: 1 / -1;">現在表示できるタスクはありません。</div>';
        }
        
        if (isLeader) {
            assignedTasksWrapper.style.display = 'block';
            if (tasksIAssigned.length === 0) {
                assignedTaskListContainer.innerHTML = '<div style="text-align:center; color:#6b7280; padding:20px; grid-column: 1 / -1;">現在振り分けたタスクはありません。</div>';
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
                    if(confirm('このタスクを削除しますか？')) {
                        socket.emit('deleteTask', {
                            taskId: e.target.getAttribute('data-id'),
                            memberId: currentUser.id,
                            password: currentUser.password
                        }, (res) => { if(!res.success) alert(res.message); });
                    }
                });
            });
        };

        sortTasks(myTasks).forEach(task => appendTaskToContainer(task, taskListContainer, false));
        if (isLeader) {
            sortTasks(tasksIAssigned).forEach(task => appendTaskToContainer(task, assignedTaskListContainer, true));
        }
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

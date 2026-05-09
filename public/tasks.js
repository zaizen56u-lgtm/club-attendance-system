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
    
    const backToPortalBtn = document.getElementById('back-to-portal-btn');
    if (backToPortalBtn) {
        backToPortalBtn.addEventListener('click', () => {
            portalSection.style.display = 'block';
            loginSection.style.display = 'none';
            taskSection.style.display = 'none';
            currentUser = null;
            selectedUserId = null;
        });
    }
    
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
        
        const TASK_LIMIT = 3;
        const uncompletedCountMap = {};
        allTasks.forEach(t => {
            if (!t.isCompleted) {
                uncompletedCountMap[t.assigneeId] = (uncompletedCountMap[t.assigneeId] || 0) + 1;
            }
        });

        // 自分自身のタスク過多バナー
        const existingBanner = document.getElementById('task-warning-banner');
        if (existingBanner) existingBanner.remove();
        
        let myUncompletedCount = myTasks.filter(t => !t.isCompleted).length;
        if (myUncompletedCount >= TASK_LIMIT) {
            const banner = document.createElement('div');
            banner.id = 'task-warning-banner';
            banner.style.marginBottom = '15px';
            banner.style.padding = '15px';
            banner.style.backgroundColor = '#FEE2E2';
            banner.style.color = '#B91C1C';
            banner.style.borderRadius = '8px';
            banner.style.border = '1px solid #FCA5A5';
            banner.style.fontWeight = 'bold';
            banner.innerHTML = `⚠️ 現在、未完了のタスクが${myUncompletedCount}つあります。負担が大きい場合はリーダーに相談してください。`;
            const headerObj = document.querySelector('#task-section .board-header');
            if (headerObj) {
                headerObj.after(banner);
            }
        }

        // Sorting helper
        const sortTasks = (tasks) => tasks.sort((a,b) => {
            if(a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const appendTaskToContainer = (task, container) => {
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
            
            html += `<div style="display: flex; flex-direction: column; gap: 5px; margin-top: auto;">`;
            
            html += `<select class="form-control progress-select" data-id="${task.id}" style="margin-top: 10px; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db; width: 100%; text-align: center; font-size: 1rem; font-weight: bold; background: #f3f4f6;">`;
            [0, 20, 40, 60, 80, 100].forEach(p => {
                const selected = p === progress ? 'selected' : '';
                html += `<option value="${p}" ${selected}>進捗: ${p}%${p === 100 ? ' (完了)' : ''}</option>`;
            });
            html += `</select>`;
            
            html += `</div>`;
            card.innerHTML = html;
            container.appendChild(card);
            
            card.querySelector('.progress-select').addEventListener('change', (e) => {
                updateProgress(e.target.getAttribute('data-id'), parseInt(e.target.value, 10));
            });
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
    
    function updateProgress(taskId, progress) {
        socket.emit('updateTaskStatus', {
            taskId: taskId,
            progress: progress,
            memberId: currentUser.id,
            password: "" // パスワード不要
        }, (res) => {
            if(!res.success) alert(res.message);
        });
    }
});

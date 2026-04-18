const globalSocket = io();

// サーバーからの強制リロード命令
globalSocket.on('forceReload', () => {
    window.location.reload();
});

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    // UI Elements
    const loginMembersGrid = document.getElementById('login-members-grid');
    const loginSection = document.getElementById('login-section');
    const taskSection = document.getElementById('task-section');
    const backToPortalBtn = document.getElementById('back-to-portal-btn');
    
    // Leader Tools UI Elements
    const taskCategorySelect = document.getElementById('task-category-select');
    const assigneeCheckboxesContainer = document.getElementById('assignee-checkboxes');
    const taskTitleInput = document.getElementById('task-title');
    const taskDescInput = document.getElementById('task-desc');
    const assignTaskPasswordInput = document.getElementById('assign-task-password');
    const addTaskBtn = document.getElementById('add-task-btn');
    const assignMsg = document.getElementById('assign-msg');
    
    // Assigned Tasks UI
    const assignedTaskListContainer = document.getElementById('assigned-task-list-container');
    
    let membersList = [];
    let selectedMember = null;
    let allTasks = [];

    // URLから?id=XX があれば自動選択
    const urlParams = new URLSearchParams(window.location.search);
    const preSelectedId = urlParams.get('id');

    // 1. メンバー一覧取得・ログイン用パネル生成
    fetch('/api/members')
        .then(response => response.json())
        .then(members => {
            membersList = members;
            renderLoginPanels();
            renderAssigneeCheckboxes(); // タスク振り分け用の選択肢を生成
            
            if (preSelectedId) {
                const member = membersList.find(m => m.id === parseInt(preSelectedId, 10));
                if (member && member.canAssignTasks === true) {
                    selectMember(member);
                }
            }
        });

    function renderLoginPanels() {
        loginMembersGrid.innerHTML = '';
        membersList.forEach(member => {
            // パネルはすべて表示するが、リーダー権限がない人は選んでもエラーになるか、UIで無効にする
            const panel = document.createElement('div');
            // パスワードを要求しないので、そのままクリックでログイン
            if (member.canAssignTasks !== true) {
                panel.className = 'member-card disabled';
                panel.style.opacity = '0.5';
                panel.style.cursor = 'not-allowed';
            } else {
                panel.className = 'member-card';
                panel.style.cursor = 'pointer';
                panel.onclick = () => selectMember(member);
            }
            
            panel.innerHTML = `
                <div class="member-info" style="justify-content: center;">
                    <div class="member-name" style="font-size: 1.1rem; text-align: center;">${member.name}</div>
                </div>
            `;
            loginMembersGrid.appendChild(panel);
        });
    }

    function renderAssigneeCheckboxes() {
        assigneeCheckboxesContainer.innerHTML = '';
        if (membersList.length === 0) {
            assigneeCheckboxesContainer.innerHTML = '<div style="color:#6b7280; font-size:0.9rem;">メンバーがいません</div>';
            return;
        }

        // 「全員を選択」チェックボックスを追加すると便利
        const selectAllLabel = document.createElement('label');
        selectAllLabel.style.display = 'block';
        selectAllLabel.style.marginBottom = '10px';
        selectAllLabel.style.paddingBottom = '10px';
        selectAllLabel.style.borderBottom = '1px solid #e5e7eb';
        selectAllLabel.style.fontWeight = 'bold';
        selectAllLabel.style.cursor = 'pointer';
        
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.className = 'assignee-checkbox-all';
        selectAllCheckbox.style.marginRight = '8px';
        
        // 全選択の挙動
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.assignee-checkbox-item');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });

        selectAllLabel.appendChild(selectAllCheckbox);
        selectAllLabel.appendChild(document.createTextNode(' 全員を選択'));
        assigneeCheckboxesContainer.appendChild(selectAllLabel);

        // 各メンバーのチェックボックス
        membersList.forEach(member => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.style.cursor = 'pointer';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = member.id;
            checkbox.className = 'assignee-checkbox-item';
            checkbox.style.marginRight = '8px';
            
            // 全選択の連動解除用
            checkbox.addEventListener('change', () => {
                if (!checkbox.checked) selectAllCheckbox.checked = false;
            });
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(`${member.name} (${member.team || '共通'})`));
            
            assigneeCheckboxesContainer.appendChild(label);
        });
    }

    // メンバー選択
    function selectMember(member) {
        selectedMember = member;
        
        // UI切り替え
        loginSection.style.display = 'none';
        taskSection.style.display = 'block';

        // タスク取得開始
        fetchTasks();
    }

    // メニューに戻るボタン
    if(backToPortalBtn) {
        backToPortalBtn.onclick = () => {
            window.location.href = `tasks.html${preSelectedId ? '?id=' + preSelectedId : ''}`;
        };
    }

    // 2. タスク取得 & 描画
    function fetchTasks() {
        socket.emit('getTasks', null, (res) => {
            if (res.success) {
                allTasks = res.tasks;
                renderTasks();
            }
        });
    }

    socket.on('tasksUpdated', (newTasks) => {
        allTasks = newTasks;
        if (selectedMember) {
            renderTasks();
        }
    });

    function renderTasks() {
        // 自分（リーダー）が振り分けたタスクのみ抽出し、描画
        const assignedByMeTasks = allTasks.filter(t => t.assignerId === selectedMember.id);
        
        assignedTaskListContainer.innerHTML = `
            <div class="task-category-section" style="margin-bottom:20px; grid-column: 1 / -1;">
                <h3 style="font-size: 1.1rem; color: #4F46E5; margin-bottom: 10px;">📋 Aチームのタスク</h3>
                <div id="assigned-team-a" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;"></div>
            </div>
            <div class="task-category-section" style="margin-bottom:20px; grid-column: 1 / -1;">
                <h3 style="font-size: 1.1rem; color: #3B82F6; margin-bottom: 10px;">📋 Bチームのタスク</h3>
                <div id="assigned-team-b" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;"></div>
            </div>
            <div class="task-category-section" style="margin-bottom:20px; grid-column: 1 / -1;">
                <h3 style="font-size: 1.1rem; color: #10B981; margin-bottom: 10px;">🌐 部全体のタスク</h3>
                <div id="assigned-overall" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;"></div>
            </div>
            <div class="task-category-section" style="grid-column: 1 / -1;">
                <h3 style="font-size: 1.1rem; color: #F59E0B; margin-bottom: 10px;">👔 マネージャーのタスク</h3>
                <div id="assigned-manager" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;"></div>
            </div>
        `;

        if (assignedByMeTasks.length === 0) {
            assignedTaskListContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 20px; color:#6b7280;">振り分けたタスクはありません</div>';
            return;
        }

        // 未完了を上、最新を上に
        assignedByMeTasks.sort((a,b) => {
            if(a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const routeTask = (task) => {
            let targetGrid;
            if (task.category === 'Aチームのタスク' || task.category === '各チームのタスク') targetGrid = document.getElementById('assigned-team-a');
            else if (task.category === 'Bチームのタスク') targetGrid = document.getElementById('assigned-team-b');
            else if (task.category === '部全体のタスク') targetGrid = document.getElementById('assigned-overall');
            else if (task.category === 'マネージャーのタスク') targetGrid = document.getElementById('assigned-manager');
            else targetGrid = document.getElementById('assigned-overall'); // Fallback
            
            appendTaskToContainer(task, targetGrid);
        };

        assignedByMeTasks.forEach(task => routeTask(task));
        
        // Hide empty category sections
        [{id: 'assigned-team-a'}, {id: 'assigned-team-b'}, {id: 'assigned-overall'}, {id: 'assigned-manager'}].forEach(info => {
            const grid = document.getElementById(info.id);
            if (grid && grid.children.length === 0) {
                grid.parentElement.style.display = 'none';
            }
        });
    }

    function appendTaskToContainer(task, container) {
        if (!container) return;
        const assigneeInfo = membersList.find(m => m.id === task.assigneeId);
        const statusText = task.isCompleted ? "完了" : "実施中";
        
        const card = document.createElement('div');
        card.className = 'member-card';
        card.setAttribute('data-status', statusText);
        
        let html = `
            <div class="member-name" style="font-size: 1.1rem; font-weight: bold; margin-bottom: 8px; word-break: break-all;">${task.title}</div>
            <div class="member-status" style="font-size: 0.9rem; padding: 4px;">宛先: ${assigneeInfo ? assigneeInfo.name : '不明'}</div>
            <div class="member-time" style="font-size: 0.85rem; margin-top: 10px; color: #6b7280; text-align: center;">状態: ${statusText}</div>
        `;
        
        if (task.desc) {
            html += `<div style="font-size: 0.9rem; margin-top: 10px; line-height: 1.4; color: #4b5563; word-break: break-all; text-align:left;">${task.desc}</div>`;
        }

        // Leader can delete
        html += `<button class="submit-btn task-action-btn delete-btn" style="background: #EF4444; margin-top:15px; grid-column: 1 / -1;">削除</button>`;
        
        card.innerHTML = html;
        card.querySelector('.delete-btn').onclick = () => {
            if(confirm(`タスク「${task.title}」を完了または削除しますか？\n(パスワードが必要です)`)){
                const pwd = prompt('タスク振り分け用共通パスワードを入力してください(小文字):');
                if(pwd) {
                    socket.emit('deleteTask', { taskId: task.id, password: pwd, memberId: selectedMember.id }, (res) => {
                        if (!res.success) alert('エラー: ' + res.message);
                    });
                }
            }
        };

        container.appendChild(card);
    }

    // 3. タスク追加
    addTaskBtn.addEventListener('click', () => {
        if (!selectedMember) return;
        
        // 複数選択された担当者を取得
        const checkboxes = document.querySelectorAll('.assignee-checkbox-item:checked');
        const assigneeIds = Array.from(checkboxes).map(cb => cb.value);
        
        const title = taskTitleInput.value.trim();
        const desc = taskDescInput.value.trim();
        const password = assignTaskPasswordInput.value;
        const category = taskCategorySelect.value;
        
        assignMsg.textContent = '';
        assignMsg.style.color = 'black';

        if (assigneeIds.length === 0) {
            assignMsg.textContent = '対象メンバーが指定されていません😭';
            assignMsg.style.color = '#EF4444';
            return;
        }
        if (!title) {
            assignMsg.textContent = 'タイトルを入力してください😭';
            assignMsg.style.color = '#EF4444';
            return;
        }
        if (!password) {
            assignMsg.textContent = '共通パスワードを入力してください😭';
            assignMsg.style.color = '#EF4444';
            return;
        }
        
        const TASK_LIMIT = 3;
        const overLimitMembers = [];
        assigneeIds.forEach(idStr => {
            const numUncompleted = allTasks.filter(t => t.assigneeId === parseInt(idStr, 10) && !t.isCompleted).length;
            if (numUncompleted + 1 >= TASK_LIMIT) {
                const member = membersList.find(m => m.id === parseInt(idStr, 10));
                if (member) {
                    overLimitMembers.push(`${member.name} (現在の未完了: ${numUncompleted}個)`);
                }
            }
        });

        if (overLimitMembers.length > 0) {
            const msg = `⚠️ 警告: 以下のメンバーは未完了タスクが合計${TASK_LIMIT}つ以上になり、負担が大きい可能性があります。\n\n${overLimitMembers.join("\n")}\n\n本当に割り当てますか？`;
            if (!confirm(msg)) {
                return;
            }
        }
        
        addTaskBtn.disabled = true;
        addTaskBtn.textContent = '送信中...';
        
        socket.emit('addTask', {
            assignerId: selectedMember.id,
            assigneeIds: assigneeIds,
            category: category,
            title: title,
            desc: desc,
            password: password
        }, (res) => {
            addTaskBtn.disabled = false;
            addTaskBtn.textContent = 'タスクを作成・送信';
            
            if (res.success) {
                assignMsg.textContent = 'タスクを送信しました🥳';
                assignMsg.style.color = '#10B981';
                taskTitleInput.value = '';
                taskDescInput.value = '';
                assignTaskPasswordInput.value = '';
                // 続けて振り分けるためにチェックボックスの状態はそのままで良い
                fetchTasks(); // 自分が割り当てたリストを更新
            } else {
                assignMsg.textContent = 'エラー: ' + res.message + '😭';
                assignMsg.style.color = '#EF4444';
            }
        });
    });
});

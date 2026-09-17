document.addEventListener('DOMContentLoaded', () => {
    const statTotal = document.getElementById('stat-total');
    const statAlerts = document.getElementById('stat-alerts');
    const alertContainer = document.getElementById('alert-container');
    const searchInput = document.getElementById('search-input');
    const displayCount = document.getElementById('display-count');
    const registerForm = document.getElementById('register-form');

    let allItems = [];
    let currentView = 'view-inventory';
    let currentCategory = '機械';
    
    // Category tabs
    const categoryTabs = document.getElementById('category-tabs');
    categoryTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.getAttribute('data-category');
            filterAndRender();
        }
    });

    // Navigation logic (SPA)
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');

    navItems.forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = nav.getAttribute('data-target');
            if (!targetId) return;

            // Update active state in sidebar
            navItems.forEach(n => n.classList.remove('active'));
            nav.classList.add('active');

            currentView = targetId;

            // Show target view, hide others
            viewSections.forEach(view => {
                view.style.display = view.id === targetId ? 'block' : 'none';
            });

            filterAndRender();

            // Auto-focus inputs based on view
            if (targetId === 'view-consume') {
                setTimeout(() => document.getElementById('scan-barcode').focus(), 100);
            } else if (targetId === 'view-register') {
                setTimeout(() => document.getElementById('item-name').focus(), 100);
            }
        });
    });

    // Fetch and display items
    const loadItems = async () => {
        try {
            const response = await fetch('/api/items');
            allItems = await response.json();
            updateDashboard();
            checkAlerts();
            filterAndRender();
        } catch (error) {
            console.error('Error loading items:', error);
        }
    };

    // Filter and limit items
    const filterAndRender = () => {
        let filtered = [];
        let targetTbody = null;

        if (currentView === 'view-inventory') {
            const query = searchInput.value.toLowerCase().trim();
            if (query) {
                filtered = allItems.filter(item => 
                    item.name.toLowerCase().includes(query) || 
                    (item.barcode && item.barcode.includes(query)) ||
                    (item.category && item.category.toLowerCase().includes(query))
                );
            } else {
                filtered = allItems;
            }
            targetTbody = document.getElementById('item-list-inventory');
            
            // Display up to 100 items to keep DOM fast
            const displayLimit = 100;
            const itemsToDisplay = filtered.slice(0, displayLimit);
            displayCount.textContent = `${itemsToDisplay.length} / ${filtered.length}`;
            renderItems(itemsToDisplay, targetTbody);

        } else if (currentView === 'view-categories') {
            if (currentCategory === 'alert') {
                filtered = allItems.filter(item => item.quantity <= item.threshold);
            } else {
                filtered = allItems.filter(item => item.category === currentCategory);
            }
            targetTbody = document.getElementById('item-list-categories');
            renderItems(filtered, targetTbody);
        }
    };

    searchInput.addEventListener('input', filterAndRender);

    // Render items in table
    const renderItems = (items, targetTbody) => {
        if (!targetTbody) return;
        targetTbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            
            let statusBadge = '';
            if (item.quantity === 0) {
                statusBadge = '<span class="badge badge-danger">在庫なし</span>';
            } else if (item.quantity <= item.threshold) {
                statusBadge = '<span class="badge badge-warning">在庫わずか</span>';
            } else {
                statusBadge = '<span class="badge badge-success">十分</span>';
            }

            tr.innerHTML = `
                <td>
                    ${item.imageUrl 
                        ? `<img src="${item.imageUrl}" alt="写真" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);">` 
                        : '<div style="width: 40px; height: 40px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: #999;">No Img</div>'}
                </td>
                <td><svg class="barcode-svg" data-barcode="${item.barcode}"></svg></td>
                <td><span class="badge" style="background:var(--secondary); color:var(--text-main); font-weight:normal;">${item.category || '未分類'}</span></td>
                <td>${item.name}</td>
                <td class="item-qty">${item.quantity}</td>
                <td>${item.threshold}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap: wrap;">
                        <input type="number" id="qty-${item.id}" value="1" min="1" style="width: 60px; padding: 0.3rem; border-radius: 4px; border: 1px solid var(--border);">
                        <button class="btn-action btn-consume" data-id="${item.id}" ${item.quantity === 0 ? 'disabled' : ''}>消費</button>
                        <button class="btn-action btn-restock" data-id="${item.id}" style="color: var(--success); border-color: var(--success);">補充</button>
                        <button class="btn-action btn-delete" data-id="${item.id}" style="background: var(--danger); color: white; border-color: var(--danger);">削除</button>
                    </div>
                </td>
            `;
            targetTbody.appendChild(tr);
        });

        // Initialize JsBarcode for all SVGs
        document.querySelectorAll('.barcode-svg').forEach(svg => {
            const val = svg.getAttribute('data-barcode');
            if (val && val !== 'undefined') {
                try {
                    JsBarcode(svg, val, {
                        format: "CODE128",
                        width: 1.5,
                        height: 30,
                        displayValue: true,
                        fontSize: 12,
                        margin: 0
                    });
                } catch (e) {
                    console.error('Barcode error', e);
                }
            }
        });

        // Add event listeners for consume buttons
        document.querySelectorAll('.btn-consume').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const qtyInput = document.getElementById(`qty-${id}`);
                const amount = parseInt(qtyInput.value, 10) || 1;
                await consumeItem(id, amount);
            });
        });

        // Add event listeners for restock buttons
        document.querySelectorAll('.btn-restock').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const qtyInput = document.getElementById(`qty-${id}`);
                const amount = parseInt(qtyInput.value, 10) || 1;
                await restockItem(id, amount);
            });
        });

        // Add event listeners for delete buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('本当にこの物品を削除しますか？\n（この操作は取り消せません）')) {
                    await deleteItem(id);
                }
            });
        });
    };

    // Delete item
    const deleteItem = async (id) => {
        try {
            const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
            if (response.ok) {
                const data = await response.json();
                showToast(`「${data.item.name}」を削除しました`, 'success');
                loadItems();
            } else {
                const err = await response.json();
                showToast(err.error, 'danger');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast('通信エラーが発生しました', 'danger');
        }
    };

    // Consume item
    const consumeItem = async (id, amount) => {
        try {
            const response = await fetch(`/api/items/${id}/consume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            if (response.ok) {
                const data = await response.json();
                showToast(`「${data.item.name}」を ${amount} 個消費しました`, 'success');
                loadItems();
            } else {
                const err = await response.json();
                showToast(err.error, 'danger');
            }
        } catch (error) {
            console.error('Error consuming item:', error);
            showToast('通信エラーが発生しました', 'danger');
        }
    };

    // Restock item
    const restockItem = async (id, amount) => {
        try {
            const response = await fetch(`/api/items/${id}/restock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            if (response.ok) {
                const data = await response.json();
                showToast(`「${data.item.name}」を ${amount} 個補充しました`, 'success');
                loadItems();
            } else {
                const err = await response.json();
                showToast(err.error, 'danger');
            }
        } catch (error) {
            console.error('Error restocking item:', error);
            showToast('通信エラーが発生しました', 'danger');
        }
    };

    // Update dashboard statistics
    const updateDashboard = () => {
        const dashboardStats = document.getElementById('dashboard-stats');
        dashboardStats.innerHTML = ''; // Clear existing

        const alertCountTotal = allItems.filter(item => item.quantity <= item.threshold).length;

        dashboardStats.innerHTML += `
            <div class="card" style="border-left: 4px solid var(--primary);">
                <h3>全体（総備品）</h3>
                <p class="card-value">${allItems.length} <span class="unit">種類</span></p>
                <p style="font-size:0.85rem; margin-top:0.5rem; color:var(--text-muted);">
                    アラート: <strong class="${alertCountTotal > 0 ? 'text-danger' : ''}">${alertCountTotal}</strong> 件
                </p>
            </div>
        `;

        const categories = ['機械', '回路', '材料（機械系）', '材料（回路系）'];
        
        categories.forEach(cat => {
            const catItems = allItems.filter(item => item.category === cat);
            const catAlerts = catItems.filter(item => item.quantity <= item.threshold).length;
            
            dashboardStats.innerHTML += `
                <div class="card">
                    <h3>${cat}</h3>
                    <p class="card-value" style="font-size: 1.5rem;">${catItems.length} <span class="unit">種類</span></p>
                    <p style="font-size:0.85rem; margin-top:0.5rem; color:var(--text-muted);">
                        アラート: <strong class="${catAlerts > 0 ? 'text-danger' : ''}">${catAlerts}</strong> 件
                    </p>
                </div>
            `;
        });
    };

    // Show alerts for low stock
    const checkAlerts = () => {
        const lowItems = allItems.filter(item => item.quantity <= item.threshold);
        
        if (lowItems.length > 0) {
            showToast(`${lowItems.length}件の物品がアラート基準を下回っています。「アラート一覧」から確認してください。`, 'warning');
        }
    };

    const showToast = (message, type = 'success') => {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert-msg alert-${type}-toast`;
        
        let icon = '成功:';
        if (type === 'warning') icon = 'アラート:';
        if (type === 'danger') icon = 'エラー:';

        alertDiv.innerHTML = `<strong>${icon}</strong> ${message}`;
        alertContainer.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertContainer.contains(alertDiv)) {
                alertDiv.style.animation = 'fadeOut 0.3s ease-out forwards';
                setTimeout(() => {
                    if (alertContainer.contains(alertDiv)) {
                        alertContainer.removeChild(alertDiv);
                    }
                }, 300);
            }
        }, 4000); // 4秒後に消える
    };

    // Consume by barcode (Cart System)
    const scanInput = document.getElementById('scan-barcode');
    const scanAmount = document.getElementById('scan-amount');
    const scannedListBody = document.getElementById('scanned-list');
    const btnSubmitScan = document.getElementById('btn-submit-scan');

    let scannedCart = [];

    const renderScannedCart = () => {
        scannedListBody.innerHTML = '';
        if (scannedCart.length === 0) {
            scannedListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">まだスキャンされていません</td></tr>';
            btnSubmitScan.disabled = true;
            return;
        }

        btnSubmitScan.disabled = false;
        scannedCart.forEach((cartItem, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold;">${cartItem.item.name}</td>
                <td><span class="badge" style="background:var(--secondary);">${cartItem.item.category || '未分類'}</span></td>
                <td style="font-size: 1.2rem; font-weight: bold; color: var(--primary);">${cartItem.amount} 個</td>
                <td><button class="btn-action btn-delete-cart" data-index="${index}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);">取消</button></td>
            `;
            scannedListBody.appendChild(tr);
        });

        document.querySelectorAll('#scanned-list .btn-delete-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                scannedCart.splice(idx, 1);
                renderScannedCart();
            });
        });
    };

    const handleBarcodeScan = () => {
        const barcode = scanInput.value.trim();
        const amount = parseInt(scanAmount.value, 10) || 1;
        scanInput.value = ''; // Clear immediately
        scanInput.focus();

        if (!barcode) return;

        const item = allItems.find(i => i.barcode === barcode);
        if (!item) {
            showToast('登録されていないバーコードです', 'danger');
            return;
        }

        const existing = scannedCart.find(c => c.item.id === item.id);
        const currentAmount = existing ? existing.amount : 0;
        
        if (item.quantity < currentAmount + amount) {
            showToast(`在庫が足りません (残り: ${item.quantity})`, 'danger');
            return;
        }

        if (existing) {
            existing.amount += amount;
        } else {
            scannedCart.push({ item, amount });
        }

        showToast(`「${item.name}」をリストに追加しました`, 'success');
        renderScannedCart();
        scanAmount.value = 1; // Reset to 1 after successful scan
    };

    // removed unused old button scan logic, replaced by submit cart button
    btnSubmitScan.addEventListener('click', async () => {
        if (scannedCart.length === 0) return;

        const itemsToConsume = scannedCart.map(c => ({ id: c.item.id, amount: c.amount }));

        try {
            const response = await fetch('/api/consume/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToConsume })
            });

            if (response.ok) {
                showToast(`${scannedCart.length}種類の備品を消費しました！`, 'success');
                scannedCart = [];
                renderScannedCart();
                loadItems();
            } else {
                const err = await response.json();
                showToast(err.error, 'danger');
            }
        } catch (error) {
            console.error('Error in bulk consume:', error);
            showToast('通信エラーが発生しました', 'danger');
        }
        scanInput.focus();
    });
    scanInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleBarcodeScan();
        }
    });



    // Image processing helper
    const processImage = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 400;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const category = document.getElementById('item-category').value;
        const name = document.getElementById('item-name').value;
        const quantity = document.getElementById('item-quantity').value;
        const threshold = document.getElementById('item-threshold').value;
        const imageFile = document.getElementById('item-image').files[0];

        try {
            const imageBase64 = await processImage(imageFile);

            const response = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, name, quantity, threshold, imageBase64 })
            });

            if (response.ok) {
                registerForm.reset();
                showToast(`新規備品を登録しました`, 'success');
                loadItems();
                
                // Return to inventory view automatically
                document.querySelector('[data-target="view-inventory"]').click();
            } else {
                const err = await response.json();
                showToast(err.error || '登録に失敗しました', 'danger');
            }
        } catch (error) {
            console.error('Error registering item:', error);
            showToast('通信エラーが発生しました', 'danger');
        }
    });

    // Initial load
    loadItems();
    scanInput.focus(); // Focus on barcode scan input by default
});


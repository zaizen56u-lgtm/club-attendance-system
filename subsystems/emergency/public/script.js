document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('emergency-banner');
    const bannerTitle = document.getElementById('banner-title');
    const bannerMessage = document.getElementById('banner-message');

    // Fetch members for the dropdown
    const loadMembers = async () => {
        try {
            const res = await fetch('/api/members');
            const members = await res.json();
            const select = document.getElementById('report-name');
            select.innerHTML = '<option value="" disabled selected>自分の名前を選択してください</option>';
            members.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = m.name;
                select.appendChild(opt);
            });
        } catch (e) {
            console.error('Failed to load members:', e);
            document.getElementById('report-name').innerHTML = '<option value="" disabled selected>メンバー取得失敗 (再読み込みしてください)</option>';
        }
    };
    loadMembers();

    // Map Rendering and Interaction
    let mapRendered = false;
    const initMap = async () => {
        const url = 'campus_map.pdf';
        const canvas = document.getElementById('map-canvas');
        const container = document.getElementById('map-container');
        const pin = document.getElementById('map-pin');
        const loading = document.getElementById('map-loading');
        const inputX = document.getElementById('report-map-x');
        const inputY = document.getElementById('report-map-y');

        if (!canvas) return; // Not on the report page

        try {
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            // Fixed internal scale for good resolution
            const scale = 2.0; 
            const viewport = page.getViewport({ scale: scale });
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
            loading.style.display = 'none';
            mapRendered = true;

            // Handle Map Clicks
            canvas.addEventListener('click', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Calculate percentage based on displayed size
                const percentX = (x / rect.width) * 100;
                const percentY = (y / rect.height) * 100;

                inputX.value = percentX.toFixed(2);
                inputY.value = percentY.toFixed(2);

                // Show pin
                pin.style.display = 'block';
                pin.style.left = `${percentX}%`;
                pin.style.top = `${percentY}%`;
            });
        } catch (err) {
            console.error('Error rendering map:', err);
            loading.textContent = 'マップの読み込みに失敗しました';
        }
    };
    initMap();

    // Navigation
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = nav.getAttribute('data-target');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            nav.classList.add('active');
            
            document.querySelectorAll('.view-section').forEach(section => {
                section.style.display = section.id === targetId ? 'block' : 'none';
            });

            if (targetId === 'view-admin') {
                loadAdminData();
                initAdminMap();
            }
        });
    });

    // Toast helper
    const showToast = (msg, isError = false) => {
        const div = document.createElement('div');
        div.className = 'toast';
        div.style.borderLeft = `4px solid ${isError ? 'var(--danger)' : 'var(--safe)'}`;
        div.textContent = msg;
        document.getElementById('toast-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);
    };

    // Load current emergency status
    const loadStatus = async () => {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            
            banner.className = `emergency-banner ${data.level}`;
            banner.style.opacity = '1';
            
            if (data.level === 'safe') bannerTitle.textContent = "平常時";
            if (data.level === 'warning') bannerTitle.textContent = "警戒・注意";
            if (data.level === 'danger') bannerTitle.textContent = "緊急事態発令中";

            bannerMessage.textContent = data.message;
        } catch (error) {
            console.error(error);
        }
    };

    // Auto-poll status every 5 seconds
    setInterval(loadStatus, 5000);
    loadStatus();

    // User: Submit report
    document.getElementById('report-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('report-name').value;
        const companions = document.getElementById('report-companions').value;
        const notes = document.getElementById('report-notes').value;
        const status = document.querySelector('input[name="report-status"]:checked').value;
        const mapX = document.getElementById('report-map-x').value;
        const mapY = document.getElementById('report-map-y').value;

        if (!name) {
            showToast("氏名を選択してください", true);
            return;
        }
        if (!mapX || !mapY) {
            showToast("マップ上をタップして現在地を指定してください", true);
            return;
        }

        const location = "マップ指定";

        try {
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, status, location, companions, notes, mapX, mapY })
            });

            if (res.ok) {
                showToast("状況を送信しました。安全を確保してください。");
                // Don't reset name, they might want to update location
                document.getElementById('report-companions').value = '';
                document.getElementById('report-notes').value = '';
            }
        } catch (error) {
            showToast("送信に失敗しました", true);
        }
    });

    // Admin: Broadcast
    document.getElementById('btn-broadcast').addEventListener('click', async () => {
        const level = document.getElementById('admin-status-level').value;
        let message = document.getElementById('admin-status-msg').value;

        // 解除時（safe）にメッセージが空の場合はデフォルトメッセージを設定する
        if (!message && level === 'safe') {
            message = "現在、非常事態は発生していません。";
            document.getElementById('admin-status-msg').value = message;
        } else if (!message) {
            showToast("メッセージを入力してください", true);
            return;
        }

        try {
            const res = await fetch('/api/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, message })
            });
            if (res.ok) {
                showToast("システムステータスを更新しました");
                loadStatus();
            }
        } catch (error) {
            showToast("エラーが発生しました", true);
        }
    });

    // Admin: Load reports
    const loadAdminData = async () => {
        try {
            const res = await fetch('/api/reports');
            const reports = await res.json();

            let greenCount = 0, yellowCount = 0, redCount = 0, blackCount = 0;
            const list = document.getElementById('report-list');
            list.innerHTML = '';
            
            const mapPinsContainer = document.getElementById('admin-map-pins-container');
            if (mapPinsContainer) mapPinsContainer.innerHTML = '';

            reports.sort((a, b) => b.timestamp - a.timestamp).forEach(r => {
                if (r.status === 'green') greenCount++;
                if (r.status === 'yellow') yellowCount++;
                if (r.status === 'red') redCount++;
                if (r.status === 'black') blackCount++;

                // Map Pins Logic
                if (mapPinsContainer && r.mapX && r.mapY) {
                    const pin = document.createElement('div');
                    pin.style.position = 'absolute';
                    pin.style.left = `${r.mapX}%`;
                    pin.style.top = `${r.mapY}%`;
                    pin.style.transform = 'translate(-50%, calc(-100% + 6px))';
                    pin.style.pointerEvents = 'auto';
                    
                    let pinColor = 'var(--triage-green)';
                    if (r.status === 'yellow') pinColor = 'var(--triage-yellow)';
                    if (r.status === 'red') pinColor = 'var(--triage-red)';
                    if (r.status === 'black') pinColor = 'var(--triage-black)';

                    let labelText = r.name;
                    if (r.companions && r.companions.trim() !== '') {
                        labelText += ` (+ ${r.companions})`;
                    }

                    pin.innerHTML = `
                        <div style="
                            background-color: ${pinColor};
                            color: ${r.status === 'yellow' ? 'black' : 'white'};
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 0.85rem;
                            font-weight: bold;
                            white-space: nowrap;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            border: 1px solid white;
                            margin-bottom: 5px;
                        ">
                            ${labelText}
                        </div>
                        <div style="
                            width: 12px;
                            height: 12px;
                            background-color: ${pinColor};
                            border-radius: 50%;
                            border: 2px solid white;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            margin: 0 auto;
                        "></div>
                    `;
                    // Add blink animation for red triage
                    if (r.status === 'red') {
                        pin.style.animation = 'blink-pin-red 1s infinite';
                    }
                    mapPinsContainer.appendChild(pin);
                }

                const tr = document.createElement('tr');
                const d = new Date(r.timestamp);
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                
                let badge = '';
                let trClass = '';
                if (r.status === 'green') badge = '<span class="triage-badge badge-green">Ⅲ (緑)</span>';
                if (r.status === 'yellow') badge = '<span class="triage-badge badge-yellow">Ⅱ (黄)</span>';
                if (r.status === 'red') {
                    badge = '<span class="triage-badge badge-red">Ⅰ (赤)</span>';
                    trClass = 'row-blink-red';
                }
                if (r.status === 'black') badge = '<span class="triage-badge badge-black">0 (黒)</span>';

                tr.className = trClass;
                tr.innerHTML = `
                    <td>${badge}</td>
                    <td style="font-weight:bold;">${r.name}</td>
                    <td>${r.location}</td>
                    <td>${r.companions || '-'}</td>
                    <td>${r.notes}</td>
                    <td style="color:var(--text-muted); font-size:0.9rem;">${timeStr}</td>
                `;
                list.appendChild(tr);
            });

            if (reports.length === 0) {
                list.innerHTML = '<tr><td colspan="5" style="text-align:center;">まだ報告はありません</td></tr>';
            }

            document.getElementById('count-green').textContent = greenCount;
            document.getElementById('count-yellow').textContent = yellowCount;
            document.getElementById('count-red').textContent = redCount;
            document.getElementById('count-black').textContent = blackCount;

            const cardRed = document.getElementById('count-red').parentElement;
            if (redCount > 0) {
                cardRed.classList.add('card-blink-red');
            } else {
                cardRed.classList.remove('card-blink-red');
            }

        } catch (error) {
            console.error('Failed to load admin data:', error);
            showToast("データの取得に失敗しました", true);
        }
    };

    // Admin: Map Rendering
    let adminMapRendered = false;
    const initAdminMap = async () => {
        const canvas = document.getElementById('admin-map-canvas');
        if (!canvas) return; // not admin page
        if (adminMapRendered) return;

        const url = 'campus_map.pdf';
        const loading = document.getElementById('admin-map-loading');

        try {
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            const scale = 2.0; 
            const viewport = page.getViewport({ scale: scale });
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const container = document.getElementById('admin-map-container');
            if (container) {
                container.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
            }
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
            loading.style.display = 'none';
            adminMapRendered = true;
        } catch (err) {
            console.error('Error rendering admin map:', err);
            loading.textContent = 'マップの読み込みに失敗しました';
        }
    };

    document.getElementById('btn-refresh').addEventListener('click', loadAdminData);

    document.getElementById('btn-reset-reports').addEventListener('click', async () => {
        if (!confirm('本当にすべての安否報告をリセットしますか？この操作は元に戻せません。')) return;
        
        try {
            const res = await fetch('/api/reports/clear', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast('全報告をリセットしました');
                loadAdminData();
            }
        } catch (err) {
            console.error('Reset error:', err);
            showToast('リセットに失敗しました', true);
        }
    });

    // Fetch initial admin data if starting on admin page
    if (document.getElementById('view-admin').style.display !== 'none') {
        loadAdminData();
        initAdminMap();
    }

    // Transit: Fetch and display transit data
    document.getElementById('btn-fetch-transit').addEventListener('click', async () => {
        const resultsContainer = document.getElementById('transit-results');
        const btn = document.getElementById('btn-fetch-transit');
        
        btn.textContent = "取得中...";
        btn.disabled = true;
        resultsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;">運行情報を確認しています...</div>';

        try {
            const res = await fetch('/api/transit');
            const data = await res.json();
            
            if (data.success) {
                resultsContainer.innerHTML = '';
                data.transit.forEach(info => {
                    let badgeColor = 'var(--text-muted)';
                    let badgeText = '情報なし';
                    
                    if (info.status === 'safe') { badgeColor = 'var(--safe)'; badgeText = '通常運転'; }
                    if (info.status === 'warning') { badgeColor = 'var(--warning)'; badgeText = '遅延あり'; }
                    if (info.status === 'danger') { badgeColor = 'var(--danger)'; badgeText = '運転見合わせ/運休'; }
                    if (info.status === 'unknown') { badgeColor = 'var(--text-muted)'; badgeText = '取得失敗'; }

                    const card = document.createElement('div');
                    card.style.border = `2px solid ${badgeColor}`;
                    card.style.borderRadius = '8px';
                    card.style.padding = '1.5rem';
                    card.style.display = 'flex';
                    card.style.justifyContent = 'space-between';
                    card.style.alignItems = 'center';
                    card.style.background = 'white';

                    card.innerHTML = `
                        <div>
                            <h3 style="margin-bottom: 0.5rem;">${info.name}</h3>
                            <p style="color: var(--text-muted);">${info.detail}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: ${badgeColor}; margin-bottom: 0.5rem;">${badgeText}</div>
                            ${info.url !== '#' ? `<a href="${info.url}" target="_blank" style="color: var(--primary); text-decoration: none;">公式サイトで確認</a>` : ''}
                        </div>
                    `;
                    resultsContainer.appendChild(card);
                });
                showToast('運行情報を取得しました');
            } else {
                resultsContainer.innerHTML = '<div style="text-align: center; color: var(--danger);">取得に失敗しました</div>';
                showToast('取得に失敗しました', true);
            }
        } catch (error) {
            resultsContainer.innerHTML = '<div style="text-align: center; color: var(--danger);">通信エラーが発生しました</div>';
            showToast('通信エラー', true);
        } finally {
            btn.textContent = "最新情報を取得 (指令)";
            btn.disabled = false;
        }
    });

    // Info Portal: Fetch News
    const btnFetchNews = document.getElementById('btn-fetch-news');
    if (btnFetchNews) {
        btnFetchNews.addEventListener('click', async () => {
            const container = document.getElementById('news-container');
            container.innerHTML = '<div style="text-align:center; padding: 2rem;">ニュースを取得中...</div>';
            
            try {
                const res = await fetch('/api/news');
                const data = await res.json();
                
                if (data.success && data.news && data.news.length > 0) {
                    container.innerHTML = '';
                    data.news.forEach(item => {
                        const dateStr = item.pubDate ? new Date(item.pubDate).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                        container.innerHTML += `
                            <div class="news-item">
                                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.3rem;">
                                    <span style="background: var(--primary); color: white; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${item.source || 'ニュース'}</span>
                                    ${dateStr ? `<span class="news-date" style="margin: 0;">${dateStr}更新</span>` : ''}
                                </div>
                                <a href="${item.link}" target="_blank">${item.title}</a>
                            </div>
                        `;
                    });
                } else {
                    container.innerHTML = '<div style="color: var(--danger); text-align:center; padding: 2rem;">ニュースが取得できませんでした。公式サイトをご確認ください。</div>';
                }
            } catch (error) {
                container.innerHTML = '<div style="color: var(--danger); text-align:center; padding: 2rem;">通信エラーが発生しました。</div>';
            }
        });
    }

    // Info Portal: Fetch Live TV Embeds
    const fetchLiveTV = async () => {
        const wnContainer = document.getElementById('tv-weathernews');
        const annContainer = document.getElementById('tv-ann');
        const ntvContainer = document.getElementById('tv-ntv');
        const tbsContainer = document.getElementById('tv-tbs');
        const fnnContainer = document.getElementById('tv-fnn');
        const nhkContainer = document.getElementById('tv-nhk');
        if (!wnContainer || !annContainer || !ntvContainer || !tbsContainer || !fnnContainer || !nhkContainer) return;

        try {
            const res = await fetch('/api/livetv');
            const data = await res.json();
            
            if (data.success && data.streams) {
                if (data.streams.weathernews) {
                    wnContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.streams.weathernews}?autoplay=1&mute=1" title="ウェザーニュースLiVE" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 8px;"></iframe>`;
                } else {
                    wnContainer.innerHTML = '<span style="color:var(--danger)">映像を取得できませんでした</span>';
                }
                
                if (data.streams.ann) {
                    annContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.streams.ann}?autoplay=1&mute=1" title="ANNnewsCH" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 8px;"></iframe>`;
                } else {
                    annContainer.innerHTML = '<span style="color:var(--danger)">映像を取得できませんでした</span>';
                }

                if (data.streams.ntv) {
                    ntvContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.streams.ntv}?autoplay=1&mute=1" title="日テレNEWS24" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 8px;"></iframe>`;
                } else {
                    ntvContainer.innerHTML = '<span style="color:var(--danger)">映像を取得できませんでした</span>';
                }

                if (data.streams.tbs) {
                    tbsContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.streams.tbs}?autoplay=1&mute=1" title="TBS NEWS DIG" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 8px;"></iframe>`;
                } else {
                    tbsContainer.innerHTML = '<span style="color:var(--danger)">映像を取得できませんでした</span>';
                }

                if (data.streams.fnn) {
                    fnnContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.streams.fnn}?autoplay=1&mute=1" title="FNN Prime Online" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 8px;"></iframe>`;
                } else {
                    fnnContainer.innerHTML = '<span style="color:var(--danger)">映像を取得できませんでした</span>';
                }

                if (data.streams.nhk) {
                    nhkContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.streams.nhk}?autoplay=1&mute=1" title="NHK NEWS" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 8px;"></iframe>`;
                } else {
                    nhkContainer.innerHTML = `
                        <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">NHK ニュース</div>
                        <div style="font-size: 0.8rem; color: #aaa; text-align: center; padding: 0 1rem;">通常時は配信されていません。<br>※災害発生時などの特別編成時のみライブ映像が自動取得されます。</div>
                    `;
                }

                const sunlabContainer = document.getElementById('tv-sunlab');
                if (sunlabContainer) {
                    if (data.streams.sunlab) {
                        sunlabContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.streams.sunlab}?autoplay=1&mute=1" title="サンラブ 地震LIVE" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 8px;"></iframe>`;
                    } else {
                        sunlabContainer.innerHTML = '<span style="color:var(--danger)">サンラブLIVE: 映像を取得できませんでした（または配信していません）</span>';
                    }
                }
            }
        } catch (e) {
            console.error(e);
            wnContainer.innerHTML = '<span style="color:var(--danger)">通信エラー</span>';
            annContainer.innerHTML = '<span style="color:var(--danger)">通信エラー</span>';
            ntvContainer.innerHTML = '<span style="color:var(--danger)">通信エラー</span>';
            tbsContainer.innerHTML = '<span style="color:var(--danger)">通信エラー</span>';
            fnnContainer.innerHTML = '<span style="color:var(--danger)">通信エラー</span>';
            nhkContainer.innerHTML = '<span style="color:var(--danger)">通信エラー</span>';
        }
    };

    // Automatically fetch live tv
    fetchLiveTV();
});

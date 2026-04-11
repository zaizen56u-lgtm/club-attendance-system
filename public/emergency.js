(function() {
    // 既存のソケットインスタンスがあるか確認し、なければ新規作成
    // (通常、各スクリプトで io() を呼んでいるため、ここでも取得する)
    const emSocket = typeof io !== 'undefined' ? io() : null;
    
    if (!emSocket) {
        console.error('Socket.io is not loaded. Emergency script failed.');
        return;
    }

    emSocket.on('emergencyStateUpdate', (state) => {
        // この端末で既にローカル解除済みなら何もしない
        if (window.emergencyUnlockedLocally) return;

        let overlay = document.getElementById('global-emergency-overlay');
        
        if (state.active) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'global-emergency-overlay';
                // 画面全体を固定（一切の操作をブロック）
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.backgroundColor = 'rgba(185, 28, 28, 0.98)'; // 濃い・強めの赤 #b91c1c
                overlay.style.zIndex = '9999999';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.justifyContent = 'center';
                overlay.style.alignItems = 'center';
                overlay.style.color = 'white';
                overlay.style.fontFamily = '"Inter", "Helvetica Neue", Arial, sans-serif';
                overlay.style.padding = '20px';
                overlay.style.textAlign = 'center';
                overlay.style.backdropFilter = 'blur(10px)'; // 背景をぼかす
                
                overlay.innerHTML = `
                    <h1 style="font-size: 2.5rem; font-weight: 900; margin-bottom: 20px; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.5); line-height: 1.2;">
                        非常事態による<br>部内における活動停止措置
                    </h1>
                    <div style="background: rgba(0, 0, 0, 0.3); padding: 30px; border-radius: 12px; max-width: 600px; width: 100%; margin-bottom: 40px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                        <h2 style="font-size: 1.1rem; margin-bottom: 15px; color: #fca5a5; font-weight: bold; border-bottom: 1px solid rgba(252,165,165,0.3); padding-bottom: 8px;">【管理者からのメッセージ】</h2>
                        <p id="emergency-reason-text" style="font-size: 1.4rem; font-weight: bold; line-height: 1.6; word-break: break-word; color: #fff;"></p>
                    </div>
                    
                    <button id="emergency-unlock-btn" style="background: transparent; border: 1px solid rgba(255,255,255,0.4); color: rgba(255,255,255,0.7); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: background 0.2s;">
                        管理者専用: この端末のみロック解除
                    </button>
                `;
                document.body.appendChild(overlay);

                // 解除ボタンのイベント (ローカル解除のみ)
                document.getElementById('emergency-unlock-btn').addEventListener('click', () => {
                    const pass = prompt('緊急事態解除用パスワードを入力してください:');
                    if (pass === 'Yamamoto5106(1!1)') {
                        window.emergencyUnlockedLocally = true;
                        if (overlay) overlay.remove();
                    } else if (pass) {
                        alert('エラー: パスワードが違います。');
                    }
                });
            }
            document.getElementById('emergency-reason-text').textContent = state.reason;
            
            // 全ての入力をフォーカスアウトさせる
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }

        } else {
            // 解除されたらオーバーレイを消す（サーバーから全体解除された場合）
            window.emergencyUnlockedLocally = false;
            if (overlay) {
                overlay.remove();
            }
        }
    });

    // ページロード時に即座に状態を取得して反映
    emSocket.emit('checkEmergencyState');

})();

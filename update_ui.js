const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(f => {
    let p = path.join(dir, f);
    let c = fs.readFileSync(p, 'utf8');
    
    // Remove emojis
    c = c.replace(/📝\s*/g, '');
    c = c.replace(/👀\s*/g, '');
    c = c.replace(/🗓️\s*/g, '');
    c = c.replace(/🔮\s*/g, '');
    c = c.replace(/🏠\s*/g, '');
    c = c.replace(/🛠️\s*/g, '');
    
    // Rename 'ロック画面へ戻る' to 'ホーム画面'
    c = c.replace(/>ロック画面へ戻る</g, '>ホーム画面<');
    
    // Add Tasks menu
    if (c.includes('出欠登録</a>') && !c.includes('tasks.html')) {
        c = c.replace(/<li><a href="future\.html">.*? 사전連絡.*?<\/a><\/li>/g, '<li><a href=\"future.html\">事前連絡一覧</a></li>\n            <li><a href=\"tasks.html\">タスク管理</a></li>');
        // Let's just do a string replace on future.html link
        c = c.replace('<li><a href="future.html">事前連絡一覧</a></li>', '<li><a href="future.html">事前連絡一覧</a></li>\n            <li><a href="tasks.html">タスク管理</a></li>');
    }
    
    // Update index.html specifically
    if (f === 'index.html' && c.includes('container form-container') && !c.includes('tasks.html')) {
        // Find the portal grid and add a button
        if (c.includes('<div class="portal-grid">')) {
            c = c.replace('</button>', '</button>\n                <button type="button" class="portal-btn" onclick="location.href=\'tasks.html\'">\n                    <div class="portal-icon">📋</div>\n                    <div class="portal-title">タスク管理</div>\n                </button>');
        }
    }
    
    fs.writeFileSync(p, c);
    console.log('Updated ' + f);
});

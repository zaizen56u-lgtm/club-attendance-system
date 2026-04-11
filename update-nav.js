const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(f => {
    if (f === 'future.html') return;
    const fp = path.join(dir, f);
    let content = fs.readFileSync(fp, 'utf8');
    if (content.includes('<li><a href="schedule.html">🗓️ スケジュール</a></li>') && !content.includes('future.html')) {
        content = content.replace(
            '<li><a href="schedule.html">🗓️ スケジュール</a></li>',
            '<li><a href="schedule.html">🗓️ スケジュール</a></li>\n            <li><a href="future.html">🔮 事前連絡一覧</a></li>'
        );
        fs.writeFileSync(fp, content);
        console.log(`Updated ${f}`);
    }
});

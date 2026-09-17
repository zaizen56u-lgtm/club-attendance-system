const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3002;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const BROADCAST_FILE = path.join(DATA_DIR, 'broadcast.json');

// Initialize data files if they don't exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(REPORTS_FILE)) {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(BROADCAST_FILE)) {
    fs.writeFileSync(BROADCAST_FILE, JSON.stringify({ message: "現在、非常事態は発生していません。", level: "safe", timestamp: Date.now() }));
}

// Helpers
const readData = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));

// API: Get current broadcast status
app.get('/api/status', (req, res) => {
    try {
        const status = readData(BROADCAST_FILE);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: "Failed to read status" });
    }
});

// API: Update broadcast status (Admin)
app.post('/api/status', (req, res) => {
    const { message, level } = req.body;
    if (!message || !level) return res.status(400).json({ error: "Message and level are required" });

    const newStatus = { message, level, timestamp: Date.now() };
    writeData(BROADCAST_FILE, newStatus);
    res.json({ success: true, status: newStatus });
});

// API: Get members (Proxy to main attendance system)
app.get('/api/members', async (req, res) => {
    try {
        const response = await fetch('http://127.0.0.1:3000/api/members');
        if (!response.ok) throw new Error("Main server returned " + response.status);
        const members = await response.json();
        res.json(members);
    } catch (error) {
        console.error("Failed to fetch members from main system:", error);
        res.status(500).json({ error: "Failed to fetch members" });
    }
});

// API: Get safety reports
app.get('/api/reports', (req, res) => {
    try {
        const reports = readData(REPORTS_FILE);
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: "Failed to read reports" });
    }
});

// API: Submit a safety report
app.post('/api/reports', (req, res) => {
    const { name, status, location, companions, notes, mapX, mapY } = req.body;
    if (!name || !status) return res.status(400).json({ error: "Name and status are required" });

    const reports = readData(REPORTS_FILE);
    
    // If the person already reported, update their report, otherwise add new
    const existingIndex = reports.findIndex(r => r.name === name);
    const newReport = {
        id: existingIndex !== -1 ? reports[existingIndex].id : Date.now().toString(),
        name,
        status,
        location: location || "不明",
        companions: companions || "",
        notes: notes || "",
        mapX: mapX || null,
        mapY: mapY || null,
        timestamp: Date.now()
    };

    if (existingIndex !== -1) {
        reports[existingIndex] = newReport;
    } else {
        reports.push(newReport);
    }

    writeData(REPORTS_FILE, reports);
    res.json({ success: true, report: newReport });
});

// API: Clear reports (Reset)
app.post('/api/reports/clear', (req, res) => {
    writeData(REPORTS_FILE, []);
    res.json({ success: true });
});

// API: Fetch transit status
app.get('/api/transit', async (req, res) => {
    try {
        const results = [];
        
        try {
            // Fetch Yahoo! Transit Kyushu area page
            const yRes = await fetch('https://transit.yahoo.co.jp/diainfo/area/7', { signal: AbortSignal.timeout(8000) });
            const html = await yRes.text();
            
            const targetLines = [
                '鹿児島本線[門司港～大牟田]',
                '鹿児島本線[大牟田～八代]',
                '豊肥本線',
                '三角線',
                '肥薩線',
                '肥薩おれんじ鉄道線'
            ];
            
            targetLines.forEach(line => {
                const escapedLine = line.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
                const regex = new RegExp(`<tr><td><a href="([^"]+)">${escapedLine}</a></td><td>(.*?)</td><td>(.*?)</td></tr>`);
                const match = html.match(regex);
                
                if (match) {
                    const url = 'https://transit.yahoo.co.jp' + match[1];
                    let statusText = match[2].replace(/<[^>]*>?/gm, '').trim();
                    let detailText = match[3].replace(/<[^>]*>?/gm, '').trim();
                    
                    let status = 'safe';
                    if (statusText !== '平常運転') {
                        if (statusText.includes('遅延') || statusText.includes('遅れ')) {
                            status = 'warning';
                        } else {
                            status = 'danger'; // 運転見合わせ, その他
                        }
                    }
                    
                    if (detailText.length > 50) detailText = detailText.substring(0, 50) + '...';
                    
                    results.push({
                        name: line,
                        status: status,
                        detail: statusText + (detailText !== '事故・遅延情報はありません' && detailText !== '' ? ' - ' + detailText : ''),
                        url: url
                    });
                } else {
                    // Line not found in the HTML (maybe HTML structure changed or line name changed)
                    results.push({ name: line, status: 'unknown', detail: '情報の取得に失敗しました', url: '#' });
                }
            });
            
            // Fetch Kyushu Shinkansen separately (It's not in area 7 local lines list)
            try {
                const sRes = await fetch('https://transit.yahoo.co.jp/diainfo/410/0', { signal: AbortSignal.timeout(8000) });
                const sHtml = await sRes.text();
                
                let sStatusText = '平常運転';
                let sDetailText = '事故・遅延情報はありません';
                let sStatus = 'safe';
                
                const dtMatch = sHtml.match(/<dt class="(normal|trouble)">(.*?)<\/dt>/s);
                const ddMatch = sHtml.match(/<dd class="(normal|trouble)">(.*?)<\/dd>/s);
                
                if (dtMatch) sStatusText = dtMatch[2].replace(/<[^>]*>?/gm, '').trim();
                if (ddMatch) sDetailText = ddMatch[2].replace(/<[^>]*>?/gm, '').trim();
                
                if (dtMatch && dtMatch[1] === 'trouble') {
                    if (sStatusText.includes('遅延') || sStatusText.includes('遅れ')) {
                        sStatus = 'warning';
                    } else {
                        sStatus = 'danger';
                    }
                }
                if (sDetailText.length > 50) sDetailText = sDetailText.substring(0, 50) + '...';
                
                results.unshift({ // Add to the top
                    name: '九州新幹線',
                    status: sStatus,
                    detail: sStatusText + (sDetailText !== '現在､事故･遅延に関する情報はありません。' && sDetailText !== '' ? ' - ' + sDetailText : ''),
                    url: 'https://transit.yahoo.co.jp/diainfo/410/0'
                });
            } catch (e) {
                console.error(e);
                results.unshift({ name: '九州新幹線', status: 'unknown', detail: '情報の取得に失敗しました', url: 'https://transit.yahoo.co.jp/diainfo/410/0' });
            }

        } catch(e) {
            console.error(e);
            results.push({ name: '交通機関の情報', status: 'unknown', detail: '情報取得サーバーエラー', url: '#' });
        }
        
        // 路線バスは汎用で追加
        results.push({ name: '路線バス（産交バスなど）', status: 'safe', detail: 'バスはリアルタイム取得が難しいため、公式サイトで最新情報をご確認ください', url: 'https://www.kyusanko.co.jp/sankobus/' });

        res.json({ success: true, transit: results });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transit data' });
    }
});

// API: Fetch Latest News (Aggregated RSS)
app.get('/api/news', async (req, res) => {
    try {
        const rssFeeds = [
            { source: 'NHK (全国)', url: 'https://www.nhk.or.jp/rss/news/cat1.xml' },
            { source: '熊本日日新聞', url: 'https://news.yahoo.co.jp/rss/media/kumanichi/all.xml' },
            { source: 'RKK (熊本放送)', url: 'https://news.yahoo.co.jp/rss/media/rkk/all.xml' },
            { source: 'TKU (テレビ熊本)', url: 'https://news.yahoo.co.jp/rss/media/tku/all.xml' },
            { source: 'KKT (県民テレビ)', url: 'https://news.yahoo.co.jp/rss/media/kkt/all.xml' },
            { source: 'KAB (熊本朝日放送)', url: 'https://news.yahoo.co.jp/rss/media/kab/all.xml' }
        ];

        let allItems = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;

        // Fetch all feeds in parallel
        await Promise.allSettled(rssFeeds.map(async (feed) => {
            const rssRes = await fetch(feed.url, { signal: AbortSignal.timeout(5000) });
            const xml = await rssRes.text();
            
            let match;
            let count = 0;
            // Get up to 3 items per feed to avoid clutter
            while ((match = itemRegex.exec(xml)) !== null && count < 3) {
                const itemContent = match[1];
                const titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
                const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
                const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
                
                if (titleMatch && linkMatch) {
                    allItems.push({
                        title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
                        link: linkMatch[1],
                        pubDate: pubDateMatch ? pubDateMatch[1] : '',
                        source: feed.source,
                        timestamp: pubDateMatch ? new Date(pubDateMatch[1]).getTime() : 0
                    });
                    count++;
                }
            }
        }));

        // Sort all items by newest first
        allItems.sort((a, b) => b.timestamp - a.timestamp);
        
        // Return top 15 items overall
        res.json({ success: true, news: allItems.slice(0, 15) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch news data' });
    }
});

// API: Fetch Live TV Video IDs dynamically
app.get('/api/livetv', async (req, res) => {
    try {
        const channels = {
            weathernews: 'https://www.youtube.com/@weathernews/live',
            ann: 'https://www.youtube.com/@ANNnewsCH/live',
            ntv: 'https://www.youtube.com/@ntv_news/live',
            tbs: 'https://www.youtube.com/@tbsnewsdig/live',
            fnn: 'https://www.youtube.com/@FNNnewsCH/live',
            nhk: 'https://www.youtube.com/@NHK_news/live',
            sunlab: 'https://www.youtube.com/watch?v=kCieFrFAZk4'
        };
        const results = {};

        await Promise.all(Object.entries(channels).map(async ([key, url]) => {
            try {
                const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
                const text = await r.text();
                const match = text.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/);
                if (match && match[1]) {
                    results[key] = match[1];
                }
            } catch (e) {
                console.error(`Failed to fetch live ID for ${key}:`, e);
            }
        }));

        res.json({ success: true, streams: results });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch live streams' });
    }
});

app.listen(PORT, () => {
    console.log(`[Emergency Subsystem] Server is running on http://localhost:${PORT}`);
});

async function test() {
    const res = await fetch('https://transit.yahoo.co.jp/diainfo/410/0');
    const html = await res.text();
    
    let statusText = '平常運転';
    let detailText = '事故・遅延情報はありません';
    let status = 'safe';
    
    // Yahoo Transit Individual line page format
    const dtMatch = html.match(/<dt class="(normal|trouble)">(.*?)<\/dt>/s);
    const ddMatch = html.match(/<dd class="(normal|trouble)">(.*?)<\/dd>/s);
    
    if (dtMatch) statusText = dtMatch[2].replace(/<[^>]*>?/gm, '').trim();
    if (ddMatch) detailText = ddMatch[2].replace(/<[^>]*>?/gm, '').trim();
    
    if (dtMatch && dtMatch[1] === 'trouble') {
        if (statusText.includes('遅延') || statusText.includes('遅れ')) {
            status = 'warning';
        } else {
            status = 'danger';
        }
    }
    console.log({ status, statusText, detailText });
}
test();

const channels = ['@FNNnewsCH', '@rkk6417'];
async function test() {
    for (const c of channels) {
        const r = await fetch('https://www.youtube.com/' + c + '/live');
        const t = await r.text();
        const m = t.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/);
        console.log(c, m ? m[1] : 'Not found');
    }
}
test();

async function test() {
    const r = await fetch('https://www.youtube.com/@FNNnewsCH/live');
    const t = await r.text();
    const m = t.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/);
    console.log('@FNNnewsCH', m ? m[1] : 'Not found');
}
test();

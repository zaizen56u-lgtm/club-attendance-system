async function getLive() {
    const r = await fetch('https://www.youtube.com/@weathernews/live');
    const t = await r.text();
    const m = t.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/);
    console.log(m ? m[1] : 'Not found');
}
getLive();

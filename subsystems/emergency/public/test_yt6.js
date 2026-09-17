const channels = ['@KAB_kumamoto', '@tku_kumamoto', '@NHKWORLDJAPAN', '@tvtokyobiz', '@KyodoNews', '@shibuyacrossing'];
async function test() {
    for (const c of channels) {
        try {
            const r = await fetch('https://www.youtube.com/' + c + '/live');
            const t = await r.text();
            const m = t.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/);
            console.log(c, m ? m[1] : 'Not found');
        } catch (e) {
            console.log(c, 'Error');
        }
    }
}
test();

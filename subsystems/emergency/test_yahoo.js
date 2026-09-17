async function test() {
    const res = await fetch('https://transit.yahoo.co.jp/diainfo/60/0');
    const html = await res.text();
    const match = html.match(/<dd class="(normal|trouble)">(.*?)<\/dd>/s);
    if (match) {
        console.log("STATUS:", match[1]);
        console.log("DETAIL:", match[2].replace(/<[^>]*>?/gm, '').trim());
    } else {
        console.log("NO MATCH");
    }
}
test();

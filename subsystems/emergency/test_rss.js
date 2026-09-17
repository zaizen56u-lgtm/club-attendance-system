async function test() {
    const res = await fetch('https://www.nhk.or.jp/rss/news/cat1.xml');
    const xml = await res.text();
    
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
        const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
        if (titleMatch && linkMatch) {
            items.push({
                title: titleMatch[1],
                link: linkMatch[1],
                pubDate: pubDateMatch ? pubDateMatch[1] : ''
            });
        }
    }
    console.log(items);
}
test();

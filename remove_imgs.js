const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');
c = c.replace(/<div class="side-image-column">[\s\S]*?<\/div>/g, '');
c = c.replace(/<div class="side-image-wrapper">[\s\S]*?<\/div>/g, '');
fs.writeFileSync('public/index.html', c);
console.log('Done');

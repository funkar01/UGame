const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<script type="module" crossorigin src="./assets/index-CObnaopu.js"></script>', '<script type="module" src="/src/main.js"></script>');
html = html.replace('<link rel="stylesheet" crossorigin href="./assets/index-DKBLZ-R9.css">', '<link rel="stylesheet" href="/style.css">');
fs.writeFileSync('index.html', html);
console.log('Fixed index.html!');

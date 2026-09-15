const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){const url=m[1];if(!url.startsWith('/'))continue;const p=decodeURIComponent(url.split('#')[0]);assert(fs.existsSync('.'+p),'Missing '+p)}
console.log('Homepage local links and assets: passed');

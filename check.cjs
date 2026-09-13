const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('assets/site.js','utf8').split('function updateCountdown')[0];
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
const t=Date.parse('2026-09-20T20:15:00Z');
for(const [now,expected] of [[t-604800000,[7,0,0,0]],[t-1000,[0,0,0,1]],[t,[0,0,0,0]],[t+1000,[0,0,0,0]]])assert.equal(JSON.stringify(ctx.countdownParts(now)),JSON.stringify(expected));
console.log('Countdown boundaries: 4 passed');
const html=fs.readFileSync('index.html','utf8');
for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){const url=m[1];if(!url.startsWith('/'))continue;const p=decodeURIComponent(url.split('#')[0]);assert(fs.existsSync('.'+p),'Missing '+p)}
console.log('Homepage local links and assets: passed');

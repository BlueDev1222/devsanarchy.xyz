// Fixed start shared by every visitor; never resets on refresh.
const EVENT_START = Date.parse('2026-09-20T16:15:00-04:00');
function countdownParts(now) {
 const s = Math.max(0, Math.ceil((EVENT_START - now) / 1000));
 return [Math.floor(s/86400), Math.floor(s/3600)%24, Math.floor(s/60)%60, s%60];
}
function updateCountdown() {
 const now = Date.now();
 countdownParts(now).forEach((v,i) => document.getElementById(['days','hours','minutes','seconds'][i]).textContent = String(v).padStart(2,'0'));
 if(now >= EVENT_START) {
  document.getElementById('event-status').textContent = 'THE WAIT IS OVER';
  document.getElementById('event-message').textContent = 'The scheduled start has arrived. Check Discord for live event status and instructions.';
 }
}
updateCountdown(); setInterval(updateCountdown,1000);
let toastTimeout;
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
 const toast = document.querySelector('.toast');
 try { await navigator.clipboard.writeText('devsanarchy.xyz'); toast.textContent = 'Server IP copied. See you in the world.'; }
 catch { toast.textContent = 'Copy this server address: devsanarchy.xyz'; }
 toast.hidden = false; clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.hidden = true,4500);
}));
const menu = document.querySelector('.menu'), nav = document.getElementById('navigation');
function closeMenu(){ nav.classList.remove('open'); menu.setAttribute('aria-expanded','false'); }
menu.addEventListener('click',()=>menu.setAttribute('aria-expanded',String(nav.classList.toggle('open'))));
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape' && nav.classList.contains('open')){closeMenu();menu.focus();}});

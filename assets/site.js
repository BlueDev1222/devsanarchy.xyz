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

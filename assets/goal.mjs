export function parseGoal(payload, config) {
  if (!Array.isArray(payload?.data)) throw new Error('Invalid sidebar response');
  const matches = payload.data.filter(module =>
    module.type === 'community_goal' && module.data?.header === config.moduleHeader);
  if (matches.length !== 1) throw new Error('Expected one matching Community Goal');
  const data = matches[0].data;
  if (typeof data.total_payments !== 'number' || !Number.isFinite(data.total_payments) ||
      data.total_payments < 0 || data.target !== config.target)
    throw new Error('Goal amount unavailable or target does not match');
  const raised = Math.round(data.total_payments * 100) / 100;
  return { raised, target: config.target, percent: Math.min(100, raised / config.target * 100) };
}

export function formatAmount(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function startGoal(document, fetcher = fetch) {
  const panel = document.getElementById('dupe-goal');
  if (!panel) return;
  const label = document.getElementById('goal-amount');
  const progress = document.getElementById('goal-progress');
  const status = document.getElementById('goal-status');
  const percent = document.getElementById('goal-percent');
  let config, lastSuccess = null, busy = false;
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      if (!config) {
        const response = await fetcher('/assets/goal-config.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Configuration unavailable');
        config = await response.json();
        if (config.currency !== 'USD' || config.target !== 50 || !config.moduleHeader) {
          config = null;
          throw new Error('Invalid goal configuration');
        }
      }
      if (!config.publicToken) {
        status.textContent = 'Purchase tracking is being connected. Visit the store to support the event.';
        config = null;
        return;
      }
      const response = await fetcher('https://headless.tebex.io/api/accounts/' +
        encodeURIComponent(config.publicToken) + '/sidebar', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Tebex unavailable');
      const goal = parseGoal(await response.json(), config);
      const amountText = formatAmount(goal.raised, config.currency) + ' raised of ' + formatAmount(goal.target, config.currency);
      label.textContent = amountText;
      progress.value = Math.min(goal.raised, goal.target);
      progress.setAttribute('aria-valuetext', amountText);
      percent.textContent = Math.floor(goal.percent) + '%';
      lastSuccess = new Date();
      status.textContent = (goal.raised >= goal.target ? 'Goal reached! ' : '') +
        'Updated from Tebex at ' + lastSuccess.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) + '. Refreshes every minute.';
    } catch {
      status.textContent = lastSuccess
        ? 'Updates delayed. Showing the last confirmed total from ' + lastSuccess.toLocaleTimeString() + '.'
        : 'Live total unavailable. Please check the Tebex store.';
    } finally { busy = false; }
  }
  refresh();
  const timer = setInterval(refresh, 60000);
  const onVisible = () => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
}
if (typeof document !== 'undefined') startGoal(document);

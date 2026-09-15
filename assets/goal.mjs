export function parseGoal(payload, config) {
  if (!Array.isArray(payload?.data)) throw new Error('Invalid sidebar response');
  const matches = payload.data.filter(module =>
    ['community_goal', 'payment_goal'].includes(module.type) && module.data?.header === config.moduleHeader);
  if (matches.length !== 1) throw new Error('Expected one matching goal module');
  const data = matches[0].data;
  const total = matches[0].type === 'payment_goal' ? data.total : data.total_payments;
  if (typeof total !== 'number' || !Number.isFinite(total) ||
      total < 0 || data.target !== config.target)
    throw new Error('Goal amount unavailable or target does not match');
  const raised = Math.round(total * 100) / 100;
  return { raised, target: config.target, percent: Math.min(100, raised / config.target * 100) };
}

export function formatAmount(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function parseTracker(payload, config) {
  if (payload?.currency !== config.currency || payload.target !== config.target ||
      typeof payload.raised !== 'number' || !Number.isFinite(payload.raised) || payload.raised < 0)
    throw new Error('Invalid tracker total');
  return {raised: payload.raised, target: payload.target,
    percent: Math.min(100, payload.raised / payload.target * 100)};
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
      const webhook = config.source === 'webhook';
      if (webhook ? !config.endpoint : !config.publicToken) {
        status.textContent = 'Purchase tracking is being connected. Visit the store to support the event.';
        config = null;
        return;
      }
      const url = webhook ? config.endpoint : 'https://headless.tebex.io/api/accounts/' +
        encodeURIComponent(config.publicToken) + '/sidebar';
      if (webhook && new URL(url).protocol !== 'https:') throw new Error('Tracker must use HTTPS');
      const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Tebex unavailable');
      const payload = await response.json();
      const goal = webhook ? parseTracker(payload, config) : parseGoal(payload, config);
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

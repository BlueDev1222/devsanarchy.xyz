const encoder = new TextEncoder();
const types = new Set(['payment.completed','payment.refunded','payment.dispute.opened',
  'payment.dispute.won','payment.dispute.lost','payment.dispute.closed']);
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
export async function verifySignature(raw, signature, secret) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature || '')) return false;
  const hash = hex(await crypto.subtle.digest('SHA-256', raw));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/../g), pair => parseInt(pair,16));
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(hash));
}
export const TOTAL_SQL = `
WITH ranked AS (
 SELECT *, ROW_NUMBER() OVER (PARTITION BY transaction_hash ORDER BY event_time DESC, priority DESC, event_id DESC) AS position
 FROM webhook_events WHERE purchase_time >= ?
), amounts AS (
 SELECT transaction_hash,
 MAX(CASE WHEN type = 'payment.completed' THEN amount_cents ELSE 0 END) AS cents,
 MAX(CASE WHEN type = 'payment.refunded' THEN 1 ELSE 0 END) AS refunded
 FROM ranked GROUP BY transaction_hash
)
SELECT COALESCE(SUM(CASE WHEN r.state = 'complete' AND a.refunded = 0 THEN a.cents ELSE 0 END),0) AS cents
FROM ranked r JOIN amounts a USING(transaction_hash) WHERE r.position = 1`;

export async function normalize(event) {
  if (!types.has(event.type)) return null;
  const subject = event.subject;
  if (typeof event.id !== 'string' || !event.id || event.id.length > 200 ||
      typeof subject?.transaction_id !== 'string' || !subject.transaction_id ||
      subject.transaction_id.length > 200) throw new Error('Missing event identifiers');
  const time = Date.parse(event.date), purchased = Date.parse(subject.created_at);
  if (!Number.isFinite(time) || !Number.isFinite(purchased)) throw new Error('Invalid event dates');
  let cents = 0;
  if (event.type === 'payment.completed') {
    const price = subject.price;
    if (price?.currency !== 'USD' || typeof price.amount !== 'number' ||
        !Number.isFinite(price.amount) || price.amount < 0 ||
        !Number.isSafeInteger(Math.round(price.amount * 100)))
      throw new Error('Expected a USD payment amount');
    cents = Math.round(price.amount * 100);
  }
  const complete = event.type === 'payment.completed' || event.type === 'payment.dispute.won' ||
    (event.type === 'payment.dispute.closed' && subject.status?.id === 1);
  const priority = event.type === 'payment.completed' ? 0 : complete ? 1 : 2;
  return [event.id, hex(await crypto.subtle.digest('SHA-256', encoder.encode(subject.transaction_id))),
    event.type, time, purchased, cents, complete ? 'complete' : 'excluded', priority];
}
async function readBody(request) {
  if (Number(request.headers.get('content-length')) > 262144) throw new Error('Too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty body');
  const chunks = []; let length = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 262144) { await reader.cancel(); throw new Error('Too large'); }
    chunks.push(value);
  }
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk,offset); offset += chunk.byteLength; }
  return result;
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const headers = {'Access-Control-Allow-Origin':'*','Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'};
    const json = (data,status=200) => Response.json(data,{status,headers});
    if (!['/goal','/webhook'].includes(path)) return json({error:'Not found'},404);
    const start = Date.parse(env.CAMPAIGN_START);
    if (!env.DB || !env.TEBEX_WEBHOOK_SECRET || !Number.isFinite(start))
      return json({error:'Tracker not configured'},503);
    try {
      if (path === '/goal' && request.method === 'GET') {
        const validated = await env.DB.prepare("SELECT value FROM tracker_meta WHERE key='validated'").first();
        if (!validated) return json({error:'Waiting for Tebex validation'},503);
        const total = await env.DB.prepare(TOTAL_SQL).bind(start).first();
        return json({raised:total.cents/100,target:50,currency:'USD',source:'tebex-webhooks',
          campaignStart:new Date(start).toISOString()});
      }
      if (path !== '/webhook' || request.method !== 'POST') return json({error:'Method not allowed'},405);
      let raw;
      try { raw = await readBody(request); } catch { return json({error:'Invalid request body'},413); }
      if (!await verifySignature(raw,request.headers.get('X-Signature'),env.TEBEX_WEBHOOK_SECRET))
        return json({error:'Invalid signature'},401);
      let event;
      try { event = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({error:'Invalid JSON'},400); }
      if (!event || typeof event !== 'object') return json({error:'Invalid event'},400);
      if (event.type === 'validation.webhook') {
        if (typeof event.id !== 'string' || !event.id || event.id.length > 200) return json({error:'Invalid validation'},400);
        await env.DB.prepare("INSERT OR REPLACE INTO tracker_meta(key,value) VALUES('validated',?)")
          .bind(new Date().toISOString()).run();
        return json({id:event.id});
      }
      let row;
      try { row = await normalize(event); } catch { return json({error:'Unsupported payment data; inspect in Tebex'},422); }
      if (row) await env.DB.prepare('INSERT OR IGNORE INTO webhook_events VALUES(?,?,?,?,?,?,?,?)').bind(...row).run();
      return json({received:true});
    } catch {
      // No raw webhook bodies, customer data, or secrets in logs/responses.
      return json({error:'Tracker temporarily unavailable'},503);
    }
  }
};

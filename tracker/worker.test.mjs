import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import worker from './worker.mjs';
function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return sqlite.prepare(sql).get(...values)},async run(){return sqlite.prepare(sql).run(...values)}}}};
 return {DB,TEBEX_WEBHOOK_SECRET:'test-only-secret',CAMPAIGN_START:'2026-09-15T00:00:00Z'};
}
function request(event, secret='test-only-secret'){
 const raw=JSON.stringify(event);
 const hash=createHash('sha256').update(raw).digest('hex');
 const signature=createHmac('sha256',secret).update(hash).digest('hex');
 return new Request('https://tracker.test/webhook',{method:'POST',headers:{'X-Signature':signature},body:raw});
}
let seq=0;
function payment(type,transaction='tbx-1',date='2026-09-15T02:00:00Z'){
 return {id:'event-'+(++seq),type,date,subject:{transaction_id:transaction,created_at:'2026-09-15T01:00:00Z',
 price:{amount:12.5,currency:'USD'},status:{id:1},customer:{email:'never-store@example.test'}}};
}
async function total(env){return (await worker.fetch(new Request('https://tracker.test/goal'),env)).json()}
async function validate(env){assert.equal((await worker.fetch(request({id:'validation',type:'validation.webhook'}),env)).status,200)}
test('requires authentic signature and validation before exposing totals',async()=>{
 const env=setup();
 assert.equal((await worker.fetch(new Request('https://tracker.test/goal'),env)).status,503);
 assert.equal((await worker.fetch(request(payment('payment.completed'),'wrong'),env)).status,401);
 await validate(env);assert.equal((await total(env)).raised,0);
});
test('duplicates, multiple purchases, refunds before completion, and no buyer data',async()=>{
 const env=setup();await validate(env);
 const event=payment('payment.completed');
 await worker.fetch(request(event),env);await worker.fetch(request(event),env);
 await worker.fetch(request({...event,id:'retry-new-id'}),env);
 assert.equal((await total(env)).raised,12.5);
 await worker.fetch(request(payment('payment.refunded','tbx-2','2026-09-15T03:00:00Z')),env);
 await worker.fetch(request(payment('payment.completed','tbx-2')),env);
 assert.equal((await total(env)).raised,12.5);
 await worker.fetch(request(payment('payment.completed','tbx-3')),env);
 assert.equal((await total(env)).raised,25);
 assert.equal(JSON.stringify(await total(env)).includes('customer'),false);
});
test('disputes exclude and won disputes restore; late older events cannot change state',async()=>{
 const env=setup();await validate(env);
 await worker.fetch(request(payment('payment.completed')),env);
 await worker.fetch(request(payment('payment.dispute.opened','tbx-1','2026-09-15T04:00:00Z')),env);
 assert.equal((await total(env)).raised,0);
 await worker.fetch(request(payment('payment.dispute.won','tbx-1','2026-09-15T05:00:00Z')),env);
 await worker.fetch(request(payment('payment.dispute.opened','tbx-1','2026-09-15T03:00:00Z')),env);
 assert.equal((await total(env)).raised,12.5);
});
test('reject currency mismatch and malformed money; exclude pre-campaign purchases',async()=>{
 const env=setup();await validate(env);
 const old=payment('payment.completed');old.subject.created_at='2026-09-01T00:00:00Z';
 await worker.fetch(request(old),env);assert.equal((await total(env)).raised,0);
 const foreign=payment('payment.completed');foreign.subject.price.currency='EUR';
 assert.equal((await worker.fetch(request(foreign),env)).status,422);
 foreign.subject.price={amount:-10,currency:'USD'};
 assert.equal((await worker.fetch(request(foreign),env)).status,422);
});

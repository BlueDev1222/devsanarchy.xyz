import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGoal, parseTracker, formatAmount, startGoal} from './assets/goal.mjs';
const config={target:50,currency:'USD',moduleHeader:'Unlock the Dupe Event',publicToken:'public-test-token'};
const payload=(total,target=50)=>({data:[{type:'community_goal',data:{header:config.moduleHeader,total_payments:total,target}}]});
test('direct tracker accepts confirmed USD amounts and rejects bad responses',()=>{
 assert.deepEqual(parseTracker({raised:75,target:50,currency:'USD'},config),{raised:75,target:50,percent:100});
 for(const raised of [null,'10',-1,NaN]) assert.throws(()=>parseTracker({raised,target:50,currency:'USD'},config));
 assert.throws(()=>parseTracker({raised:10,target:50,currency:'EUR'},config));
});
test('direct tracker URL is used instead of the unavailable sidebar',async()=>{
 const elements=Object.fromEntries(['dupe-goal','goal-amount','goal-progress','goal-status','goal-percent'].map(id=>[id,{textContent:'',setAttribute(){}}]));
 const doc={hidden:false,getElementById:id=>elements[id],addEventListener(){},removeEventListener(){}};
 const calls=[];
 const fetcher=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('goal-config')
   ? {...config,source:'webhook',endpoint:'https://tracker.example/goal'}
   : {raised:25,target:50,currency:'USD'}}};
 const stop=startGoal(doc,fetcher);
 try {await new Promise(resolve=>setImmediate(resolve));assert.equal(elements['goal-amount'].textContent,'$25 raised of $50');assert.equal(calls[1],'https://tracker.example/goal')}finally{stop()}
});
test('Payment Goal uses its exact total and rejects hidden amounts',()=>{
 const payment = {type:'payment_goal', data:{header:config.moduleHeader,total:17.25,target:50}};
 assert.deepEqual(parseGoal({data:[payment]},config),{raised:17.25,target:50,percent:34.5});
 payment.data.total=null;
 assert.throws(()=>parseGoal({data:[payment]},config));
 payment.data.total=0;
 assert.equal(parseGoal({data:[payment]},config).raised,0);
 assert.throws(()=>parseGoal({data:[payment,...payload(10).data]},config));
});
test('real zero, partial and over-goal amounts',()=>{
 assert.deepEqual(parseGoal(payload(0),config),{raised:0,target:50,percent:0});
 assert.deepEqual(parseGoal(payload(12.5),config),{raised:12.5,target:50,percent:25});
 assert.deepEqual(parseGoal(payload(62.5),config),{raised:62.5,target:50,percent:100});
 assert.equal(formatAmount(0,'USD'),'$0');
 assert.equal(formatAmount(12.5,'USD'),'$12.50');
});
test('reject unknown, hidden, wrong-target and ambiguous goals',()=>{
 for(const total of [null,undefined,-1,NaN,'12.50']) assert.throws(()=>parseGoal(payload(total),config));
 assert.throws(()=>parseGoal(payload(0,100),config));
 assert.throws(()=>parseGoal({data:[]},config));
 const duplicate=payload(0);duplicate.data.push(duplicate.data[0]);assert.throws(()=>parseGoal(duplicate,config));
});
test('refresh from Tebex, preserve confirmed total on failure, recover',async()=>{
 const elements=Object.fromEntries(['dupe-goal','goal-amount','goal-progress','goal-status','goal-percent'].map(id=>[id,{textContent:'',setAttribute(){}}]));
 const listeners={};const doc={hidden:false,getElementById:id=>elements[id],addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}};
 let fail=false,raised=0;
 const fetcher=async url=>{if(url.includes('goal-config'))return {ok:true,json:async()=>config};if(fail)throw Error();return {ok:true,json:async()=>payload(raised)}};
 const stop=startGoal(doc,fetcher);
 try{
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements['goal-amount'].textContent,'$0 raised of $50');
 raised=20;listeners.visibilitychange();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements['goal-progress'].value,20);
 fail=true;listeners.visibilitychange();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements['goal-amount'].textContent,'$20 raised of $50');
 assert.match(elements['goal-status'].textContent,/Updates delayed/);
 fail=false;raised=50;listeners.visibilitychange();await new Promise(resolve=>setImmediate(resolve));
 assert.match(elements['goal-status'].textContent,/Goal reached/);
 }finally{stop()}
});

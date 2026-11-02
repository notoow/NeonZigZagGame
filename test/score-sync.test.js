import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScoreSync} from '../score-sync.js';
const result=()=>({run:{uid:'alice',runId:'run-1'},name:'Player',score:5,activeMs:3000});
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('game finish automatically submits and clears durable pending score',async()=>{
 const storage=memory(),calls=[],states=[];
 const sync=new ScoreSync({storage,submit:async(...args)=>calls.push(args),onState:s=>states.push(s)});
 await sync.record(result());assert.equal(calls.length,1);assert.equal(calls[0][2],5);assert.equal(sync.pending,null);assert.deepEqual(states,['saving','saved']);
});
test('failed save survives reload and only retries for the same account',async()=>{
 const storage=memory();const sync=new ScoreSync({storage,submit:async()=>{throw Error('offline');}});
 await assert.rejects(sync.record(result()));let calls=0;
 const restored=new ScoreSync({storage,submit:async()=>calls++});await restored.flush('bob');assert.equal(calls,0);
 await restored.flush('alice');assert.equal(calls,1);assert.equal(restored.pending,null);
});
test('concurrent retries submit once and snapshot the completed run',async()=>{
 let done,calls=0;const sync=new ScoreSync({storage:memory(),submit:()=>{calls++;return new Promise(resolve=>done=resolve);}});
 const input=result(),saving=sync.record(input);input.run.runId='changed';const retry=sync.flush('alice');
 assert.equal(sync.pending.run.runId,'run-1');assert.equal(calls,1);done();await Promise.all([saving,retry]);
});
test('malformed stored data cannot break startup',()=>{const sync=new ScoreSync({submit:async()=>{},storage:{getItem:()=>'{"score":5}'}});assert.equal(sync.pending,null);});

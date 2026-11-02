import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveRun} from '../live-run.js';
import {ScoreSync} from '../score-sync.js';
test('live transport preserves order and retries the exact request after ambiguous failure',async()=>{
 const calls=[];let fail=true;
 const live=new LiveRun({uid:'alice',runId:'r'},async body=>{calls.push(body);if(fail){fail=false;throw Error('offline');}return {score:1};});
 live.input(.6);live.enqueue('tick',1);await assert.rejects(live.flush());
 await live.flush();assert.deepEqual(calls[0],calls[1]);assert.equal(live.seq,1);
 live.input(1.2);live.enqueue('finish',1.4);const stored=JSON.parse(JSON.stringify(live.seal()));
 await new LiveRun(stored,async body=>{calls.push(body);}).flush();assert.equal(calls[2].seq,2);assert.deepEqual(calls[2].inputs,[1200]);assert.equal(calls[2].score,undefined);
});
test('sealing during an in-flight checkpoint leaves final delivery to durable score sync',async()=>{
 const calls=[];let resolve;
 const live=new LiveRun({uid:'alice',runId:'r'},body=>{calls.push(body);return new Promise(r=>resolve=r);});
 live.enqueue('tick',1);const flight=live.flush();live.input(1.2);live.enqueue('finish',1.4);const stored=live.seal();resolve({});await flight;
 assert.equal(calls.length,1);assert.equal(stored.queue.length,2);
 const retried=[];await new LiveRun(stored,async b=>retried.push(b)).flush();assert.equal(retried[0].seq,1);assert.equal(retried[1].seq,2);
});
test('partial durable delivery resumes at last acknowledgement after reload',async()=>{
 let value,serverSeq=0,fail=true;
 const storage={getItem:()=>value,setItem:(_,v)=>value=v,removeItem:()=>value=null};
 const submit=(run,_n,_s,_a,progress)=>new LiveRun(run,async body=>{if(body.seq===3&&fail){fail=false;throw Error('offline');}assert.equal(body.seq,serverSeq+1);serverSeq=body.seq;return {};},progress).flush();
 const sync=new ScoreSync({submit,storage}),run={uid:'alice',runId:'r',protocol:3,seq:0,queue:[{op:'tick',elapsedMs:200,inputs:[]},{op:'tick',elapsedMs:2200,inputs:[600,1200,1800]},{op:'finish',elapsedMs:2300,inputs:[]}]};
 await assert.rejects(sync.record({run,name:'Player',score:3,activeMs:2300}));assert.equal(JSON.parse(value).run.seq,2);
 await new ScoreSync({submit,storage}).flush('alice');assert.equal(serverSeq,3);assert.equal(value,null);
});

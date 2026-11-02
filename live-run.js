// Ordered, retryable live input envelopes. Scores and names never go to the API.
export class LiveRun{
 constructor(run,send,onProgress=()=>{}){this.run=run;this.send=send;this.onProgress=onProgress;this.seq=run.seq||0;this.queue=structuredClone(run.queue||[]);this.inputs=[];this.inFlight=null;}
 input(time){this.inputs.push(time*1000);}
 enqueue(op,time){this.queue.push({op,elapsedMs:time*1000,inputs:this.inputs.splice(0)});}
 snapshot(){return {...this.run,protocol:3,seq:this.seq,queue:structuredClone(this.queue)};}
 seal(){const snapshot=this.snapshot();this.queue=[];return snapshot;}
 async flush(){
  if(this.inFlight)return this.inFlight;
  this.inFlight=(async()=>{
   let result;
   while(this.queue.length){const item=this.queue[0];result=await this.send({runId:this.run.runId,seq:this.seq+1,...item});this.seq++;this.queue.shift();this.onProgress(this.snapshot());}
   return result;
  })();
  try{return await this.inFlight;}finally{this.inFlight=null;}
 }
}

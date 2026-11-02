// One durable pending result; never replace a run before its score is settled.
export class ScoreSync {
 constructor({submit,storage,onState=()=>{}}){this.submit=submit;this.storage=storage;this.onState=onState;this.pending=null;this.inFlight=null;try{const value=JSON.parse(storage?.getItem('neon-pending-score')||'null');if(value?.run?.uid&&value.run.runId&&Number.isInteger(value.score)&&value.score>=0)this.pending=value;}catch{}}
 persist(){try{this.pending?this.storage?.setItem('neon-pending-score',JSON.stringify(this.pending)):this.storage?.removeItem('neon-pending-score');}catch{}}
 async record({run,name,score,activeMs}){
  if(!run)return;
  if(this.pending&&this.pending.run.runId!==run.runId)throw new Error('Previous score pending');
  this.pending={run:{...run},name,score,activeMs};this.persist();return this.flush(run.uid);
 }
 async flush(uid){
  if(this.inFlight)return this.inFlight;
  if(!this.pending||this.pending.run.uid!==uid)return;
  const result=this.pending;this.onState('saving');
  this.inFlight=(async()=>{
   try{await this.submit(result.run,result.name,result.score,result.activeMs,next=>{if(this.pending===result){result.run=next;this.persist();}});if(this.pending===result){this.pending=null;this.persist();}this.onState('saved');}
   catch(error){if(['LEGACY_RUN','RUN_EXPIRED','RUN_USED','CLOCK_MISMATCH','INPUT_AFTER_DEATH','INPUT_ORDER'].includes(error.code)){this.pending=null;this.persist();this.onState('expired');}else this.onState('error');throw error;}
   finally{this.inFlight=null;}
  })();
  return this.inFlight;
 }
}

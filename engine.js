export function seasonRandom(){let seed=20261102;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export const RULESET='v2';
export const BEAT=.6; // 100 BPM; the shortest turn is an eighth note (300 ms).
export const EARLY=.16, LATE=.12, PERFECT=.045;
const phrases=[[1,1,1,1],[1,.5,.5,1,1],[.5,.5,.5,.5,1,1],[1.5,.5,1,1]];
export class Game {
 constructor(random=Math.random){
  this.random=random;this.points=[{x:90,y:0,t:0},{x:198,y:-108,t:BEAT}];
  this.index=0;this.time=0;this.score=0;this.perfect=0;this.accepted=false;this.alive=true;this.phrase=[];this.x=90;this.y=0;this.lastJudgment='';this.fillPath();
 }
 get target(){return this.points[this.index+1];}
 get remaining(){return this.target.t-this.time;}
 get direction(){return Math.sign(this.target.x-this.points[this.index].x);}
 fillPath(){
  while(this.points.length<this.index+16){
   const last=this.points.at(-1),prev=this.points.at(-2),dir=last.x>prev.x?-1:1;
   if(!this.phrase.length)this.phrase=[...phrases[this.points.length<10?0:Math.floor(this.random()*phrases.length)]];
   let beats=this.phrase.shift();
   while((last.x+dir*108*beats<40||last.x+dir*108*beats>320)&&beats>.5)beats-=.5;
   // Every generated point remains on the musical grid and inside the playfield.
   this.points.push({x:last.x+dir*108*beats,y:last.y-108*beats,t:last.t+BEAT*beats});
  }
 }
 tap(){
  if(!this.alive)return 'stopped';
  if(this.accepted)return 'duplicate';
  const error=this.time-this.target.t;
  if(error < -EARLY-1e-9)return this.lastJudgment='early';
  if(error > LATE+1e-9){this.alive=false;return this.lastJudgment='miss';}
  this.accepted=true;this.score++;
  const judgment=Math.abs(error)<=PERFECT+1e-9?'perfect':'good';
  if(judgment==='perfect')this.perfect++;
  this.lastJudgment=judgment;this.resolve();return judgment;
 }
 advance(seconds){if(!this.alive)return;this.time+=Math.max(0,seconds);this.resolve();}
 resolve(){
  if(this.time>=this.target.t&&this.accepted){this.index++;this.accepted=false;this.fillPath();}
  if(this.time>this.target.t+LATE+1e-9){this.alive=false;this.lastJudgment='miss';}
  const a=this.points[this.index],b=this.target,f=Math.max(0,(this.time-a.t)/(b.t-a.t));
  this.x=a.x+(b.x-a.x)*f;this.y=a.y+(b.y-a.y)*f;
  if(this.index>40){this.points.splice(0,this.index-8);this.index=8;}
  if(this.time>1200)this.alive=false;
 }
}

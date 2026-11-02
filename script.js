import {LiveRun} from './live-run.js';
import {getPlayer,onPlayerChange,restoreAccount,signInAccount,signOutAccount,beginRun,submitScore,topScores,rankedRequest} from './ranking.js?v=6';
import {ScoreSync} from './score-sync.js';
import {loginNotoow} from './notoow-login.js';
import {Game,BEAT,seasonRandom} from './engine.js';
const $=id=>document.getElementById(id),canvas=$('gameCanvas'),ctx=canvas.getContext('2d');
let game=new Game(),mode='ready',previous=0,raf=0,scale=1,h=800,best=0,rankRun=null,identityHidden=false,accountLoading=true;
let liveRun=null,lastCheckpoint=0,resumeQueued=false;
let audio,soundOn=true,nextBeat=0,flash=0,judgment='';
try{best=Number(localStorage.getItem('neon-v2-best'))||0;}catch{}
$('best').textContent=best;
const logo=new Image();logo.src='./notoow-2d.png';logo.onload=()=>draw();
const clock=()=>audio?.state==='running'?audio.currentTime:performance.now()/1000;
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);scale=rect.width/360;h=rect.height/scale;ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);draw();}
function openAudio(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();return audio.resume().catch(()=>{});}catch{return Promise.resolve();}}
function tone(frequency,time,duration=.08,volume=.035,type='sine'){
 if(!audio||!soundOn)return;
 const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.connect(gain);gain.connect(audio.destination);osc.frequency.value=frequency;gain.gain.setValueAtTime(volume,time);gain.gain.exponentialRampToValueAtTime(.001,time+duration);osc.start(time);osc.stop(time+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
}
function music(){
 if(!audio)return;
 // Schedule ahead on the audio clock, not one sound per rendered frame.
 while(nextBeat*BEAT/2 < game.time+.12){
  const at=audio.currentTime+(nextBeat*BEAT/2-game.time);
  if(at>=audio.currentTime){const beat=((nextBeat%8)+8)%8;tone(beat%2?1400:beat===0?100:180,at,beat%2?.025:.10,beat%2?.012:.04,beat%2?'triangle':'sine');if(beat===0&&game.time>=0)tone([110,130.81,146.83,130.81][Math.floor(nextBeat/8)%4],at,.22,.025,'triangle');}
  nextBeat++;
 }
}
function screens(active){document.querySelectorAll('.screen').forEach(el=>el.hidden=el.id!==active);}
function status(text){$('input-status').textContent=text;}
let storage;try{storage=localStorage;identityHidden=storage.getItem('neon-hide-name')==='1';}catch{}
const scoreSync=new ScoreSync({submit:submitScore,storage,onState:state=>{
 $('rank-message').textContent=state==='saving'?'저장 중…':state==='saved'?'저장됨':state==='expired'?'기록 만료':'저장 실패';
 $('retry-save').hidden=state!=='error';
 $('quick-retry').disabled=state==='saving';
 if(state==='saved'&&$('rank-dialog').open)showRanks();
}});
function renderAccount(){
 const player=getPlayer();
 $('account-name').textContent=player?(identityHidden?'••••••':player.name):(accountLoading?'연결 중…':'로그인');
 $('account-name').disabled=accountLoading;
 $('name-visibility').hidden=!player;$('name-visibility').setAttribute('aria-pressed',String(identityHidden));
 $('name-visibility').setAttribute('aria-label',identityHidden?'이름 표시':'이름 숨기기');
 $('name-visibility').classList.toggle('is-hidden',identityHidden);
 $('ranked-btn').hidden=Boolean(player);$('start-btn').textContent='플레이';
}
onPlayerChange(renderAccount);
let accountError=false;
const accountReady=restoreAccount().then(async player=>{if(player)await scoreSync.flush(player.uid).catch(()=>{});return player;}).catch(()=>{accountError=true;return null;}).finally(()=>{accountLoading=false;renderAccount();});
async function login(){
 if(mode==='playing'||mode==='loading')return;
 const token=loginNotoow();$('account-name').disabled=true;$('start-status').textContent='로그인 중…';
 try{await signInAccount(await token);accountError=false;await scoreSync.flush(getPlayer().uid);$('start-status').textContent='';}
 catch(error){$('start-status').textContent=error.message==='LOGIN_CANCELLED'?'':error.message==='POPUP_BLOCKED'?'팝업을 허용해 주세요.':'로그인 실패';}
 finally{renderAccount();}
}
$('account-name').addEventListener('click',()=>{if(getPlayer())$('account-menu').hidden=!$('account-menu').hidden;else login();});
$('name-visibility').addEventListener('click',()=>{identityHidden=!identityHidden;try{storage?.setItem('neon-hide-name',identityHidden?'1':'0');}catch{}renderAccount();if($('rank-dialog').open)showRanks();});
$('sign-out').addEventListener('click',async()=>{if(mode==='playing'||mode==='paused'||mode==='loading')return;if(scoreSync.pending){await savePending();if(scoreSync.pending)return;}await signOutAccount();$('account-menu').hidden=true;renderAccount();});
async function savePending(){try{await scoreSync.flush(getPlayer()?.uid);}catch{}}
$('retry-save').addEventListener('click',savePending);window.addEventListener('online',savePending);
async function start(){
 if(mode==='loading'||mode==='playing')return;
 const previousMode=mode;mode='loading';await openAudio();await accountReady;
 $('start-btn').disabled=true;$('quick-retry').disabled=true;$('start-status').textContent='';
 try{
  if(accountError){await restoreAccount();accountError=false;}
  const player=getPlayer();
  if(player)await scoreSync.flush(player.uid);
  rankRun=player?await beginRun():null;
  liveRun=rankRun?new LiveRun(rankRun,rankedRequest):null;lastCheckpoint=performance.now();
  game=new Game(seasonRandom(rankRun?.seed));game.time=-BEAT*3;nextBeat=-6;flash=0;previous=clock();mode='playing';screens(null);canvas.focus({preventScroll:true});
  $('score-board').textContent='0';$('play-mode').textContent='100 BPM';$('pause-btn').hidden=false;status('3');
  $('account-menu').hidden=true;cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
 }catch(error){mode=previousMode;$('start-status').textContent='연결 실패 · 다시 눌러주세요.';if(previousMode==='over')$('rank-message').textContent='저장 실패 · 다시 눌러주세요.';}
 finally{$('start-btn').disabled=false;$('quick-retry').disabled=false;}
}
function sync(){const now=clock(),delta=Math.max(0,now-previous);previous=now;if(delta>.25){pause();return;}game.advance(delta);}
function input(){
 if(mode!=='playing')return;sync();if(mode!=='playing'||game.time<0)return;
 if(game.alive)liveRun?.input(game.time);
 const result=game.tap();
 if(result==='perfect'||result==='good'){
  judgment=result==='perfect'?'PERFECT':'GOOD';status(judgment);flash=1;
  if(audio)tone(result==='perfect'?880:660,audio.currentTime,.065,.055,'triangle');
  $('score-board').textContent=game.score;
 }else if(result==='early')status('조금 빨라요');
 if(!game.alive)finish();else draw();
}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();input();});
window.addEventListener('keydown',e=>{
 if(!['Space','KeyZ','KeyX'].includes(e.code)||e.repeat||e.target.closest('input,button,dialog'))return;
 e.preventDefault();if(mode==='ready'||mode==='over')start();else input();
});
$('start-btn').addEventListener('click',start);$('ranked-btn').addEventListener('click',login);
$('pause-menu').addEventListener('click',()=>{mode='ready';liveRun=null;rankRun=null;screens('start-screen');$('pause-btn').hidden=true;});
$('restart-btn').addEventListener('click',()=>{mode='ready';screens('start-screen');$('pause-btn').hidden=true;});
$('quick-retry').addEventListener('click',start);
$('sound-btn').addEventListener('click',()=>{soundOn=!soundOn;$('sound-btn').setAttribute('aria-pressed',String(soundOn));$('sound-btn').textContent=soundOn?'사운드 켜짐':'사운드 꺼짐';});
function pause(){if(mode!=='playing')return;mode='paused';resumeQueued=false;cancelAnimationFrame(raf);screens('pause-screen');if(liveRun){liveRun.enqueue('pause',game.time);liveRun.flush().catch(()=>{status('연결 확인');});}}
$('pause-btn').addEventListener('click',pause);
$('resume-btn').addEventListener('click',async()=>{if(mode!=='paused')return;$('resume-btn').disabled=true;try{if(liveRun){await liveRun.flush();if(!resumeQueued){liveRun.enqueue('resume',game.time);resumeQueued=true;}await liveRun.flush();}await openAudio();mode='playing';previous=clock();lastCheckpoint=performance.now();nextBeat=Math.ceil(game.time/(BEAT/2));screens(null);canvas.focus({preventScroll:true});raf=requestAnimationFrame(loop);}catch{status('연결 확인 · 다시 눌러주세요.');}finally{$('resume-btn').disabled=false;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
function loop(){
 if(mode!=='playing')return;sync();if(mode!=='playing')return;
 if(game.time<0)status(String(Math.ceil(-game.time/BEAT)));else if(game.time<.15)status('GO');
 music();flash*=.88;$('score-board').textContent=game.score;
 const beat=((Math.floor(game.time/BEAT)%4)+4)%4;
 [...$('beat-meter').children].forEach((el,i)=>el.classList.toggle('on',i===beat));draw();
 if(!game.alive){finish();return;}
 if(liveRun&&performance.now()-lastCheckpoint>=2000){lastCheckpoint=performance.now();const current=liveRun;current.enqueue('tick',game.time);current.flush().catch(()=>{if(liveRun===current)pause();});}
 raf=requestAnimationFrame(loop);
}
function finish(){
 if(mode==='over')return;mode='over';cancelAnimationFrame(raf);if(audio)tone(90,audio.currentTime,.25,.07,'sawtooth');
 best=Math.max(best,game.score);try{localStorage.setItem('neon-v2-best',String(best));}catch{}
 $('best').textContent=best;$('final-score').textContent=game.score;$('accuracy').textContent=`PERFECT ${game.perfect} / ${game.score}`;
 $('pause-btn').hidden=true;screens('game-over-screen');$('rank-message').textContent='';$('retry-save').hidden=true;
 const player=getPlayer();
 if(liveRun&&rankRun&&player){
  liveRun.enqueue('finish',game.time);
  scoreSync.record({run:liveRun.seal(),name:player.name,score:game.score,activeMs:Math.min(1200000,Math.round(game.time*1000))}).catch(()=>{});
 }

}
function draw(){
 ctx.fillStyle='#090a14';ctx.fillRect(0,0,360,h);
 const camera=game.y-h*.70;ctx.save();ctx.translate(0,-camera);
 const points=game.points;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
 points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#00dce8';ctx.lineWidth=34;ctx.shadowColor='#00dce8';ctx.shadowBlur=10;ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#172232';ctx.lineWidth=31;ctx.stroke();
 points.slice(game.index+1).forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,i===0?10:4,0,Math.PI*2);ctx.strokeStyle=i===0?'#ffdb79':'#426977';ctx.lineWidth=2;ctx.stroke();});
 const corner=game.target,remaining=Math.max(0,game.remaining),approach=Math.min(1,remaining/BEAT);
 ctx.beginPath();ctx.arc(corner.x,corner.y,10+approach*24,0,Math.PI*2);ctx.strokeStyle=remaining<.16?'#ffdb79':'#827c56';ctx.lineWidth=2;ctx.stroke();
 ctx.save();ctx.translate(game.x,game.y);
 const surface=ctx.createRadialGradient(-4,-5,1,0,0,13);surface.addColorStop(0,'#ffe0b7');surface.addColorStop(.4,'#f8a77b');surface.addColorStop(1,'#b53e27');
 ctx.shadowBlur=16;ctx.shadowColor='#e85d3b';ctx.fillStyle=surface;ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 ctx.strokeStyle='#ffceab';ctx.lineWidth=.8;ctx.stroke();
 if(logo.complete&&logo.naturalWidth){ctx.globalAlpha=.92;ctx.drawImage(logo,-8,-8,16,16);ctx.globalAlpha=1;}
 ctx.strokeStyle='rgba(255,239,215,.55)';ctx.lineWidth=.9;ctx.beginPath();ctx.arc(-1,-1,9,Math.PI*1.12,Math.PI*1.6);ctx.stroke();ctx.restore();
 if(flash>.05){ctx.beginPath();ctx.arc(game.x,game.y,12+(1-flash)*24,0,Math.PI*2);ctx.strokeStyle=`rgba(255,220,120,${flash})`;ctx.stroke();}ctx.restore();
}
async function showRanks(){
 if(!$('rank-dialog').open)$('rank-dialog').showModal();$('rank-status').textContent='불러오는 중…';$('rank-list').replaceChildren();$('rank-list').hidden=true;
 try{const rows=await topScores();$('rank-status').textContent=rows.length?'':'첫 기록을 남겨보세요.';
 $('rank-list').hidden=rows.length===0;
 rows.forEach((row,index)=>{const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('b');name.textContent=`${index+1}. ${identityHidden&&row.uid===getPlayer()?.uid?'플레이어':row.nickname}`;score.textContent=row.score;li.append(name,score);$('rank-list').append(li);});
 }catch{$('rank-status').textContent='랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';}
}
document.querySelectorAll('[data-ranks]').forEach(el=>el.addEventListener('click',showRanks));$('close-ranks').addEventListener('click',()=>$('rank-dialog').close());$('refresh-ranks').addEventListener('click',showRanks);
window.addEventListener('resize',resize);resize();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});

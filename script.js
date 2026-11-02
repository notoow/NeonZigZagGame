import {loginNotoow} from './notoow-login.js';
import {Game,BEAT,seasonRandom} from './engine.js';
const $=id=>document.getElementById(id),canvas=$('gameCanvas'),ctx=canvas.getContext('2d');
let game=new Game(),mode='ready',previous=0,raf=0,scale=1,h=800,best=0,rankRun=null,rankingPromise;
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
async function loadRanking(){if(!rankingPromise)rankingPromise=import('./ranking.js').catch(error=>{rankingPromise=null;throw error;});return rankingPromise;}
async function start(ranked=false){
 if(mode==='loading'||mode==='playing')return;
 const login=ranked?loginNotoow():null;if(login)login.catch(()=>{});
 mode='loading';rankRun=null;await openAudio();$('start-status').textContent=ranked?'랭킹 연결 중…':'';
 $('start-btn').disabled=true;$('ranked-btn').disabled=true;
 if(ranked){try{rankRun=await (await loadRanking()).beginRun(await login);}catch(error){$('start-status').textContent=error.message==='LOGIN_CANCELLED'?'로그인 창을 닫았어요.':error.message==='POPUP_BLOCKED'?'팝업을 허용한 뒤 다시 눌러주세요.':'로그인 연결을 확인하고 다시 시도해 주세요.';mode='ready';$('start-btn').disabled=false;$('ranked-btn').disabled=false;return;}}
 game=new Game(ranked?seasonRandom():Math.random);game.time=-BEAT*3;nextBeat=-6;flash=0;previous=clock();mode='playing';screens(null);canvas.focus({preventScroll:true});
 $('score-board').textContent='0';$('play-mode').textContent=rankRun?'랭킹 도전 · 100 BPM':'100 BPM';$('pause-btn').hidden=false;status('3');
 $('start-btn').disabled=false;$('ranked-btn').disabled=false;cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}
function sync(){const now=clock(),delta=Math.max(0,now-previous);previous=now;if(delta>.25){pause();return;}game.advance(delta);}
function input(){
 if(mode!=='playing')return;sync();if(mode!=='playing'||game.time<0)return;
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
 e.preventDefault();if(mode==='ready'||mode==='over')start(false);else input();
});
$('start-btn').addEventListener('click',()=>start(false));$('ranked-btn').addEventListener('click',()=>start(true));
$('restart-btn').addEventListener('click',()=>{mode='ready';screens('start-screen');$('pause-btn').hidden=true;});
$('quick-retry').addEventListener('click',()=>start(false));
$('sound-btn').addEventListener('click',()=>{soundOn=!soundOn;$('sound-btn').setAttribute('aria-pressed',String(soundOn));$('sound-btn').textContent=soundOn?'사운드 켜짐':'사운드 꺼짐';});
function pause(){if(mode!=='playing')return;mode='paused';cancelAnimationFrame(raf);screens('pause-screen');}
$('pause-btn').addEventListener('click',pause);
$('resume-btn').addEventListener('click',async()=>{await openAudio();mode='playing';previous=clock();nextBeat=Math.ceil(game.time/(BEAT/2));screens(null);canvas.focus({preventScroll:true});raf=requestAnimationFrame(loop);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
function loop(){
 if(mode!=='playing')return;sync();if(mode!=='playing')return;
 if(game.time<0)status(String(Math.ceil(-game.time/BEAT)));else if(game.time<.15)status('GO');
 music();flash*=.88;$('score-board').textContent=game.score;
 const beat=((Math.floor(game.time/BEAT)%4)+4)%4;
 [...$('beat-meter').children].forEach((el,i)=>el.classList.toggle('on',i===beat));draw();
 if(!game.alive){finish();return;}raf=requestAnimationFrame(loop);
}
function finish(){
 if(mode==='over')return;mode='over';cancelAnimationFrame(raf);if(audio)tone(90,audio.currentTime,.25,.07,'sawtooth');
 best=Math.max(best,game.score);try{localStorage.setItem('neon-v2-best',String(best));}catch{}
 $('best').textContent=best;$('final-score').textContent=game.score;$('accuracy').textContent=`PERFECT ${game.perfect} / ${game.score}`;
 $('pause-btn').hidden=true;screens('game-over-screen');$('submit-score').hidden=!rankRun||game.score<1;
 $('rank-message').textContent=rankRun?'닉네임과 점수가 공개돼요.':'랭킹 도전으로 시작하면 기록을 올릴 수 있어요.';$('submit-btn').disabled=false;
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
 if(!$('rank-dialog').open)$('rank-dialog').showModal();$('rank-status').textContent='불러오는 중…';$('rank-list').replaceChildren();
 try{const rows=await (await loadRanking()).topScores();$('rank-status').textContent=rows.length?'리듬 모드 · 시즌 2':'첫 기록을 남겨보세요.';
 rows.forEach((row,index)=>{const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('b');name.textContent=`${index+1}. ${row.nickname}`;score.textContent=row.score;li.append(name,score);$('rank-list').append(li);});
 }catch{$('rank-status').textContent='랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';}
}
document.querySelectorAll('[data-ranks]').forEach(el=>el.addEventListener('click',showRanks));$('close-ranks').addEventListener('click',()=>$('rank-dialog').close());$('refresh-ranks').addEventListener('click',showRanks);
$('submit-score').addEventListener('submit',async e=>{e.preventDefault();if(!rankRun||$('submit-btn').disabled)return;const submittedRun=rankRun,submittedScore=game.score,submittedMs=Math.min(1200000,Math.round(game.time*1000)),nickname=$('nickname').value.trim();$('submit-btn').disabled=true;$('quick-retry').disabled=true;$('restart-btn').disabled=true;$('rank-message').textContent='기록 저장 중…';
 try{const saved=await (await loadRanking()).submitScore(submittedRun,nickname,submittedScore,submittedMs);$('rank-message').textContent=saved?'최고 기록을 저장했어요.':'기존 최고 기록이 더 높아요.';rankRun=null;$('submit-score').hidden=true;}
 catch{$('rank-message').textContent='저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';$('submit-btn').disabled=false;}finally{$('quick-retry').disabled=false;$('restart-btn').disabled=false;}
});
window.addEventListener('resize',resize);resize();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});

export function loginNotoow(){
 const nonce=crypto.randomUUID();
 const popup=window.open('about:blank','notoow-game-login-'+nonce);
 if(!popup)return Promise.reject(new Error('POPUP_BLOCKED'));
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error,token)=>{if(settled)return;settled=true;clearTimeout(timeout);clearInterval(closed);window.removeEventListener('message',receive);try{popup.close();}catch{}error?reject(error):resolve(token);};
  const receive=event=>{if(event.origin!=='https://notoow.com'||event.source!==popup||event.data?.type!=='NOTOOW_GAME_LOGIN'||event.data?.nonce!==nonce)return;
   if(typeof event.data.token==='string'&&event.data.token.length<10000)finish(null,event.data.token);
  };
  window.addEventListener('message',receive);
  const timeout=setTimeout(()=>finish(new Error('LOGIN_TIMEOUT')),300000);
  const closed=setInterval(()=>{try{if(popup.closed)finish(new Error('LOGIN_CANCELLED'));}catch{}},1000);
  popup.location.href='https://notoow.com/auth/game/#'+nonce;
 });
}

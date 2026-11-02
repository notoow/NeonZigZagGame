import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loginNotoow} from '../notoow-login.js';
test('account popup accepts only its own source, origin and nonce',async()=>{
 const original=globalThis.window;let receive,removed=false;const popup={location:{},closed:false,close(){this.closed=true;}};
 globalThis.window={open:()=>popup,addEventListener:(name,fn)=>receive=fn,removeEventListener:()=>removed=true};
 try{const result=loginNotoow();const nonce=popup.location.href.split('#')[1];let settled=false;result.then(()=>settled=true);
 for(const change of [{origin:'https://evil.test'},{source:{}},{data:{type:'NOTOOW_GAME_LOGIN',nonce:'wrong',token:'token'}}])receive({origin:'https://notoow.com',source:popup,data:{type:'NOTOOW_GAME_LOGIN',nonce,token:'token'},...change});
 await Promise.resolve();assert.equal(settled,false);
 receive({origin:'https://notoow.com',source:popup,data:{type:'NOTOOW_GAME_LOGIN',nonce,token:'verified'}});
 assert.equal(await result,'verified');assert.ok(removed);assert.ok(popup.closed);
 }finally{globalThis.window=original;}
});
test('blocked popup produces a recoverable login error',async()=>{const original=globalThis.window;globalThis.window={open:()=>null};try{await assert.rejects(loginNotoow(),/POPUP_BLOCKED/);}finally{globalThis.window=original;}});

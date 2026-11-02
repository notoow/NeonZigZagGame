import {backend} from './firebase-config.js';
import {rankingStore} from './ranking-store.js';
let connection,appCheck,player=null;
const listeners=new Set();
export const getPlayer=()=>player;
export const hasRankedSession=()=>player!==null;
export function onPlayerChange(listener){listeners.add(listener);listener(player);return ()=>listeners.delete(listener);}
function setPlayer(next){player=next;listeners.forEach(fn=>fn(player));return player;}
const deadline=(promise,ms=30000)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Connection timeout')),ms);})]).finally(()=>clearTimeout(timer));};
async function connect(){
 if(!backend.enabled)throw new Error('Rankings not configured');
 if(!connection)connection=(async()=>{
  const [appSDK,authSDK,sdk,checkSDK]=await Promise.all(['app','auth','firestore','app-check'].map(name=>import(`https://www.gstatic.com/firebasejs/13.1.0/firebase-${name}.js`)));
  const app=appSDK.getApps().find(app=>app.name==='neon-zigzag')||appSDK.initializeApp(backend.firebase,'neon-zigzag');
  appCheck??=checkSDK.initializeAppCheck(app,{provider:new checkSDK.ReCaptchaEnterpriseProvider(backend.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
  const auth=authSDK.getAuth(app);await deadline(auth.authStateReady());
  await authSDK.setPersistence(auth,authSDK.browserLocalPersistence);
  const context={auth,authSDK,db:sdk.getFirestore(app),sdk};
  return {...context,store:rankingStore(context,`sites/${backend.siteId}`,backend.season)};
 })().catch(error=>{connection=null;throw error;});
 return deadline(connection);
}
async function readPlayer(auth){
 if(!auth.currentUser)return setPlayer(null);
 const token=await auth.currentUser.getIdTokenResult();
 if(token.claims.notoow_account!==true)return setPlayer(null);
 return setPlayer({uid:auth.currentUser.uid,name:String(token.claims.notoow_name||'플레이어').replace(/[\x00-\x1f\x7f]/g,'').slice(0,16)||'플레이어'});
}
export async function restoreAccount(){const {auth}=await connect();return readPlayer(auth);}
export async function signInAccount(customToken){
 const {auth,authSDK}=await connect();
 await deadline(authSDK.signInWithCustomToken(auth,customToken));
 const account=await readPlayer(auth);if(!account)throw new Error('NOTOOW_LOGIN_REQUIRED');return account;
}
export async function signOutAccount(){const {auth,authSDK}=await connect();await authSDK.signOut(auth);setPlayer(null);}
export async function beginRun(){const {auth,store}=await connect();if(!await readPlayer(auth))throw new Error('NOTOOW_LOGIN_REQUIRED');return deadline(store.beginRun());}
export async function topScores(){return deadline((await connect()).store.topScores());}
export async function submitScore(run,nickname,score,activeMs){return deadline((await connect()).store.submitScore(run,nickname,score,activeMs));}

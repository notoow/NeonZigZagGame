import {backend} from './firebase-config.js';
let connection,appCheck,verifiedUid=null;
export const hasRankedSession=()=>verifiedUid!==null;
const deadline=(promise,ms=30000)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Connection timeout')),ms);})]).finally(()=>clearTimeout(timer));};
async function connect(){
 if(!backend.enabled)throw new Error('Rankings not configured');
 if(!connection)connection=(async()=>{
  const [appSDK,authSDK,dbSDK,checkSDK]=await Promise.all(['app','auth','firestore','app-check'].map(name=>import(`https://www.gstatic.com/firebasejs/13.1.0/firebase-${name}.js`)));
  console.info('Rankings: SDK loaded');
  const app=appSDK.getApps().find(app=>app.name==='neon-zigzag')||appSDK.initializeApp(backend.firebase,'neon-zigzag');
  const check=appCheck??=checkSDK.initializeAppCheck(app,{provider:new checkSDK.ReCaptchaEnterpriseProvider(backend.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
  await deadline(checkSDK.getToken(check));console.info('Rankings: App Check ready');
  const auth=authSDK.getAuth(app);await deadline(auth.authStateReady());console.info('Rankings: auth ready');
  return {auth,authSDK,db:dbSDK.getFirestore(app),sdk:dbSDK};
 })().catch(error=>{connection=null;throw error;});
 return deadline(connection).catch(error=>{console.warn('Rankings connection:',error.code||error.message);throw error;});
}
const base=`sites/${backend.siteId}`;
export async function beginRun(customToken){
 const {auth,authSDK,db,sdk}=await connect();
 if(customToken){
  verifiedUid=null;
  await deadline(authSDK.setPersistence(auth,authSDK.inMemoryPersistence));
  await deadline(authSDK.signInWithCustomToken(auth,customToken));
 }else if(!verifiedUid||auth.currentUser?.uid!==verifiedUid)throw new Error('NOTOOW_LOGIN_REQUIRED');
 const claims=await auth.currentUser.getIdTokenResult();
 if(claims.claims.notoow_account!==true){verifiedUid=null;throw new Error('NOTOOW_LOGIN_REQUIRED');}
 verifiedUid=auth.currentUser.uid;
 const uid=auth.currentUser.uid,runId=crypto.randomUUID();
 await deadline(sdk.setDoc(sdk.doc(db,`${base}/runs/${uid}`),{runId,season:backend.season,startedAt:sdk.serverTimestamp(),used:false}));
 return {uid,runId};
}
export async function topScores(){
 const {db,sdk}=await connect();
 const snapshot=await deadline(sdk.getDocs(sdk.query(sdk.collection(db,`${base}/leaderboards/${backend.season}/scores`),sdk.orderBy('score','desc'),sdk.limit(20))));
 return snapshot.docs.map(doc=>doc.data());
}
export async function submitScore(run,nickname,score,activeMs){
 if(!nickname||nickname.length>16||/[\x00-\x1f\x7f]/.test(nickname)||!Number.isInteger(score)||score<1)throw new Error('Invalid score');
 const {auth,db,sdk}=await connect();if(auth.currentUser?.uid!==run.uid)throw new Error('Player changed');
 const runRef=sdk.doc(db,`${base}/runs/${run.uid}`),scoreRef=sdk.doc(db,`${base}/leaderboards/${backend.season}/scores/${run.uid}`);
 return deadline(sdk.runTransaction(db,async transaction=>{
  const session=await transaction.get(runRef),old=await transaction.get(scoreRef);
  if(session.data()?.runId!==run.runId||session.data()?.used)throw new Error('Run expired');
  const improved=!old.exists()||score>old.data().score;
  if(!improved)return false;
  transaction.update(runRef,{used:true});
  transaction.set(scoreRef,{nickname,score,activeMs,runId:run.runId,updatedAt:sdk.serverTimestamp()});
  return true;
 }));
}

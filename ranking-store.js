// Firestore operations shared by the browser and emulator integration tests.
export function rankingStore({auth,db,sdk},base,season){
 return {
  async beginRun(){
   if(!auth.currentUser)throw new Error('NOTOOW_LOGIN_REQUIRED');
   const uid=auth.currentUser.uid,runId=crypto.randomUUID();
   await sdk.setDoc(sdk.doc(db,`${base}/runs/${uid}`),{runId,season,startedAt:sdk.serverTimestamp(),used:false});
   return {uid,runId};
  },
  async topScores(){
   const snapshot=await sdk.getDocs(sdk.query(sdk.collection(db,`${base}/leaderboards/${season}/scores`),sdk.orderBy('score','desc'),sdk.limit(20)));
   return snapshot.docs.map(doc=>({...doc.data(),uid:doc.id}));
  },
  async submitScore(run,nickname,score,activeMs){
   if(!nickname||nickname.length>16||/[\x00-\x1f\x7f]/.test(nickname)||!Number.isInteger(score)||score<1)throw new Error('Invalid score');
   if(auth.currentUser?.uid!==run.uid)throw new Error('Player changed');
   const runRef=sdk.doc(db,`${base}/runs/${run.uid}`),scoreRef=sdk.doc(db,`${base}/leaderboards/${season}/scores/${run.uid}`);
   return sdk.runTransaction(db,async tx=>{
    const session=await tx.get(runRef),old=await tx.get(scoreRef);
    // A timed-out response may follow a committed write. Retrying is a success.
    if(old.exists()&&old.data().score>=score)return false;
    if(session.data()?.runId!==run.runId||session.data()?.used)throw new Error('Run expired');
    tx.update(runRef,{used:true});
    tx.set(scoreRef,{nickname,score,activeMs,runId:run.runId,updatedAt:sdk.serverTimestamp()});
    return true;
   });
  }
 };
}

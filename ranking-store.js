// Public reads only. Ranked mutations are exclusively served by neon-ranked.
export function rankingStore({auth,db,sdk},base,season){
 return {
  async topScores(){
   const snapshot=await sdk.getDocs(sdk.query(sdk.collection(db,`${base}/leaderboards/${season}/scores`),sdk.orderBy('score','desc'),sdk.limit(20)));
   return snapshot.docs.map(doc=>({...doc.data(),uid:doc.id}));
  }
 };
}

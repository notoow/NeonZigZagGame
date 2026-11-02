import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,BEAT,EARLY,LATE} from '../engine.js';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
test('10,000 generated turns remain in bounds with at least 300ms between hits',()=>{
 const game=new Game(rng(42));
 for(let i=0;i<10000;i++){
  const a=game.points[game.index],b=game.target;
  assert.ok(b.x>=40-1e-8&&b.x<=320+1e-8);assert.ok(b.t-a.t>=.3-1e-8);
  game.advance(game.remaining);game.alive=true;assert.equal(game.tap(),'perfect');
  // Long-run generation stress, beyond the real 20-minute cap.
  game.alive=true;
 }
 assert.equal(game.score,10000);assert.ok(game.points.length<60);
});
test('two rapid inputs cannot undo an already registered turn',()=>{
 const game=new Game();game.advance(BEAT-.08);
 assert.equal(game.tap(),'good');assert.equal(game.tap(),'duplicate');
 game.advance(.08);assert.equal(game.score,1);assert.equal(game.direction,-1);assert.equal(game.alive,true);
});
test('early buffer and late grace are measured in time, not rendered frames',()=>{
 for(const offset of [-EARLY,0,LATE]){const g=new Game();g.advance(BEAT+offset);assert.ok(['good','perfect'].includes(g.tap()));assert.equal(g.score,1);}
 const early=new Game();early.advance(BEAT-EARLY-.001);assert.equal(early.tap(),'early');assert.equal(early.score,0);
 const missed=new Game();missed.advance(BEAT+LATE+.001);assert.equal(missed.alive,false);
});
test('the same timestamped inputs produce the same game at 30, 60, 144 and 240Hz',()=>{
 const results=[];
 for(const hz of [30,60,144,240]){
  const g=new Game(rng(4));
  for(let i=0;i<80;i++){
   const at=g.target.t-.02;while(g.time+1/hz<at)g.advance(1/hz);
   g.advance(at-g.time);g.tap();g.advance(g.target.t-g.time);
  }
  results.push([g.score,g.perfect,g.time,g.x,g.y]);
 }
 for(const result of results.slice(1))result.forEach((v,i)=>assert.ok(Math.abs(v-results[0][i])<1e-7));
});
test('short zigzag phrase can be cleared by alternating inputs without an animation lock',()=>{
 const g=new Game(()=>.6);
 for(let i=0;i<100;i++){g.advance(g.remaining);assert.equal(g.tap(),'perfect');}
 assert.equal(g.score,100);assert.equal(g.alive,true);
});

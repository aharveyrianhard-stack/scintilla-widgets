import test from 'node:test';
import assert from 'node:assert/strict';
import {traceStation,timeIndex,indexTime,clampView,wheelTransaction} from '../chart-workshop/station-renderer.mjs';
import {dailyCurveAnchors} from '../chart-workshop/layout.mjs';
import {cloudInk,ribbonTone} from '../chart-workshop/station-bridge.mjs';
import {readFileSync} from 'node:fs';
test('Station price trace retains the same quadratic commands and exact endpoints',()=>{
 const calls=[],ctx=Object.fromEntries(['moveTo','lineTo','quadraticCurveTo'].map(k=>[k,(...v)=>calls.push([k,...v])]));
 traceStation(ctx,[{x:0,y:1},{x:1,y:3},{x:2,y:2}]);
 assert.deepEqual(calls,[['moveTo',0,1],['quadraticCurveTo',1,3,1.5,2.5],['lineTo',2,2]]);
});
test('closed-market gaps occupy one bar interval and time mapping roundtrips',()=>{
 const bars=[0,1,4,5].map(t=>({t:t*86400000}));
 for(let i=0;i<4;i++)assert.equal(timeIndex(bars,bars[i].t),i);
 for(const i of [.5,1.5,2.7])assert.ok(Math.abs(timeIndex(bars,indexTime(bars,i))-i)<1e-9);
});
test('view clamping preserves span when panning beyond loaded edges',()=>{
 assert.deepEqual(clampView({start:-10,end:10},100),{start:0,end:20});
 assert.deepEqual(clampView({start:95,end:115},100),{start:79,end:99});
});
test('trackpad horizontal axis locks despite vertical momentum noise; pinch zoom is separate',()=>{
 let r=wheelTransaction(null,{deltaX:20,deltaY:2,width:1000},100);
 assert.equal(r.state.mode,'pan');r=wheelTransaction(r.state,{deltaX:1,deltaY:30,width:1000},120);assert.equal(r.state.mode,'pan');
 assert.equal(wheelTransaction(r.state,{ctrlKey:true,deltaY:5,width:1000},130).state.mode,'zoom');
 assert.equal(wheelTransaction(null,{shiftKey:true,deltaY:40,width:1000},200).state.mode,'pan');
});
test('all price intervals use identical confirmed daily anchors without recalculation',()=>{
 const rows=[1,2,5].map((d,i)=>({time:d*86400000,e13:10+i,s50:5+i})),before=structuredClone(rows);
 assert.deepEqual(dailyCurveAnchors(rows),[{...rows[0],sourceTime:rows[0].time,time:rows[1].time},{...rows[1],sourceTime:rows[1].time,time:rows[2].time}]);
 assert.deepEqual(rows,before);
 const renderer=readFileSync(new URL('../chart-workshop/workshop.mjs',import.meta.url),'utf8');
 assert.match(renderer,/dailyCurveAnchors\(averages,this.end\)/);assert.doesNotMatch(renderer,/dailyOnIntraday\(/);
 assert.match(renderer,/c.lineWidth=metrics.priceWidth/);assert.match(renderer,/c.lineWidth=indicatorStroke\(s,metrics\)/);
});
test('intraday right-edge labels carry only the last available daily value',()=>{
 const rows=[1,2,5].map((d,i)=>({time:d*86400000,e13:10+i}));
 const actual=dailyCurveAnchors(rows,3*86400000);
 assert.equal(actual.at(-1).time,3*86400000);assert.equal(actual.at(-1).e13,10);
 assert.equal(actual.at(-1).sourceTime,86400000);assert.equal(actual.at(-1).displayOnly,true);
 assert.ok(actual.every(r=>r.sourceTime<r.time));
});
test('indigo separates three brightness tiers and pink has the bounded six-percent trial',()=>{
 const blue=['fast','middle','slow'].map(layer=>cloudInk({bullish:true,color:'#3455FF',layer}));
 const levels=blue.map(v=>Number(v.match(/,(\d+)\)$/)[1]));
 assert.ok(levels[0]-levels[1]>=70);assert.ok(levels[1]-levels[2]>=60);
 for(const opacity of [10,17,22]){
   const channels=cloudInk({bullish:false,color:'#FF00A8',opacity}).match(/\d+/g).map(Number);
   const gain=Math.sqrt(opacity/100)*.94;
   assert.deepEqual(channels,[Math.round(255*gain),0,Math.round(168*gain)]);
 }
});

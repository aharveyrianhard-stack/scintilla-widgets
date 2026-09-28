import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudPolygons} from '../chart-workshop/model.mjs';
const keys=['e13','e21','s50','s200'];
test('crossing MA polygons tile the whole ribbon without gaps or overlaps',()=>{
 let seed=210926;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32)*500;
 for(let n=0;n<1000;n++){
  const a=Object.fromEntries(keys.map(k=>[k,random()])),b=Object.fromEntries(keys.map(k=>[k,random()]));
  const before=JSON.stringify([a,b]),polygons=cloudPolygons(a,b);
  for(const t of [.13,.37,.79]){
   const values=keys.map(k=>a[k]+(b[k]-a[k])*t);
   const sections=polygons.filter(p=>p.t0<=t&&p.t1>t).map(p=>{
    const f=(t-p.t0)/(p.t1-p.t0);return[p.previousLo+(p.lo-p.previousLo)*f,p.previousHi+(p.hi-p.previousHi)*f];
   }).sort((x,y)=>x[0]-y[0]);
   assert.ok(Math.abs(sections[0][0]-Math.min(...values))<1e-8);
   assert.ok(Math.abs(sections.at(-1)[1]-Math.max(...values))<1e-8);
   for(let i=1;i<sections.length;i++)assert.ok(Math.abs(sections[i][0]-sections[i-1][1])<1e-8);
  }
  assert.equal(JSON.stringify([a,b]),before);
 }
});
test('coincident and warm-up boundaries remain finite without fabricated slow averages',()=>{
 const a={e13:100,e21:100,s50:null,s200:null},b={...a,e13:110};
 assert.ok(cloudPolygons(a,b).every(p=>p.layer==='fast'));
 assert.equal(cloudPolygons(a,a).length,0);
});
test('fastest interval owns overlap and all color roles follow boundary order',()=>{
 const a={e13:130,e21:100,s50:120,s200:110};
 const p=cloudPolygons(a,a);assert.equal(p.length,3);assert.ok(p.every(p=>p.layer==='fast'&&p.bullish));
});

// DOM/canvas contract test, not a screenshot or browser visual acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const geometry=JSON.parse(fs.readFileSync(new URL('../indicator-workbench/geometry-capture.json',import.meta.url)));
test('all four views execute their canvas paths and control transitions',async()=>{
  let paintCalls=0;const draw=new Proxy({}, {get:(_,name)=>()=>{paintCalls++;},set:()=>true});
  const els=new Map();const element=()=>({value:'',checked:false,hidden:false,options:[],style:{},children:[],classList:{toggle(){},add(){},remove(){}},clientWidth:1200,clientHeight:750,append(x){this.children.push(x);},replaceChildren(){this.children=[];},addEventListener(){},querySelectorAll(){return[];},getContext(){return draw;}});
  const defaults={template:'combined',symbol:'SPY',tf:'D',style:'line'};
  const get=s=>{if(!els.has(s))els.set(s,element());return els.get(s);};for(const [id,value]of Object.entries(defaults))get('#'+id).value=value;
  for(const id of ['rsi','stoch','signal','zones','tail'])get('#'+id).checked=true;
  globalThis.document={querySelector:get,createElement:element,body:{dataset:{}}};
  globalThis.window={parent:null,addEventListener(){}};window.parent=window;
  globalThis.location={hostname:'localhost',origin:'http://localhost',search:''};globalThis.devicePixelRatio=1;
  globalThis.ResizeObserver=class{observe(){}};
  const series=Array.from({length:300},(_,i)=>{const c=100+i*.1+Math.sin(i/4)*3;return{t:1700000000000+i*86400000,o:c-.2,c,h:c+1,l:c-1,v:10000+i*20};});
  globalThis.fetch=async url=>({ok:true,json:async()=>{
    if(url.includes('geometry-capture'))return geometry;
    const p=new URL(url,'http://localhost').searchParams;
    if(url.includes('quote'))return{symbol:'SPY',quote:{symbol:'SPY',price:130,previous_close:129}};
    return{symbol:p.get('symbol'),tf:p.get('tf'),series,provider:'synthetic-test-only'};
  }});
  await import('../indicator-workbench/app.mjs');
  await new Promise(r=>setTimeout(r,10));
  assert.match(get('#status').textContent,/10\/10/);assert.ok(paintCalls>100);
  for(const mode of ['separate','full','geometry']){get('#template').value=mode;await get('#template').onchange();assert.equal(document.body.dataset.template,mode);}
  assert.match(get('#status').textContent,/Frozen MCP/);assert.ok(get('#screen').children.length);
  get('#tf').value='W';await get('#tf').onchange();get('#style').value='candles';get('#style').onchange();
  get('#template').value='combined';await get('#template').onchange();assert.match(get('#status').textContent,/10\/10/);
});

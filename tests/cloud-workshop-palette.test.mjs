import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {palette,specs,cloudSpecs,computeAverages,cloudBands,cloudSegments} from '../chart-workshop/model.mjs';

test('workshop approved indigo trial strengthens blue and preserves pink',()=>{
  assert.deepEqual(palette,{blue:'#3455FF',pink:'#FF00A8'});
  assert.equal(Number.parseInt(palette.pink.slice(1,3),16),255);
  assert.equal(Number.parseInt(palette.pink.slice(3,5),16),0);
  assert.ok(Object.isFrozen(palette));
});

test('every approved alpha and stroke hierarchy remains exact',()=>{
  assert.deepEqual(specs.map(({width,blueOpacity,pinkOpacity})=>[width,blueOpacity,pinkOpacity]),
    [[.6,20,8],[1,26,10],[2,32,13],[3,38,16],[3,41,18.5],[4,44,21]]);
  assert.deepEqual(cloudSpecs,{fast:{blueOpacity:44,pinkOpacity:22},middle:{blueOpacity:36,pinkOpacity:17},slow:{blueOpacity:26,pinkOpacity:10}});
  assert.deepEqual(specs.map(s=>s.stateKey),['price','f','f','m','price','o']);
  assert.deepEqual(specs.map(s=>s.style),['dashed','solid','solid','solid','dashed','solid']);
  assert.equal(specs.find(s=>s.key==='s100').disabledByDefault,true);
});

test('EMA8 adds only one line and never changes existing cloud geometry',()=>{
  const row={e13:120,e21:110,s50:100,s200:90,f:true,m:true,o:true};
  for(const e8 of [1,90,105,130,10000])assert.deepEqual(cloudBands({...row,e8}),cloudBands(row));
  assert.equal(specs.find(s=>s.key==='e8').style,'dashed');
  const bars=Array.from({length:400},(_,i)=>({t:1600000000000+i*86400000,o:100+i,h:101+i,l:99+i,c:100+i,v:1}));
  const rows=computeAverages(bars);
  for(const n of [8,13,21]){
    let value=bars[0].c;for(let i=1;i<bars.length;i++)value+=(bars[i].c-value)*2/(n+1);
    assert.ok(Math.abs(rows.at(-1)['e'+n]-value)<1e-10);
  }
});

test('line, fill, leader, caption and legend hue roles share the workshop palette',()=>{
  const renderer=readFileSync(new URL('../chart-workshop/workshop.mjs',import.meta.url),'utf8');
  const css=readFileSync(new URL('../chart-workshop/workshop.css',import.meta.url),'utf8');
  assert.match(renderer,/Object.entries\(palette\)\)document.documentElement.style.setProperty\(`--cloud-\$\{role\}`,color\)/);
  assert.match(renderer,/c.strokeStyle=ribbonInk\(bull\?palette.blue:palette.pink,bull\?s.blueOpacity:s.pinkOpacity\)/);
  assert.match(renderer,/c.fillStyle=cloudInk\(v\)/);
  assert.match(renderer,/if\(row.displaced\)\{c.strokeStyle=rgba\(bull\?palette.blue:palette.pink,55\)/);
  for(const role of ['blue','pink']){
    assert.ok(css.includes(`.end-label.${role}{color:var(--cloud-${role})}`));
    assert.ok(css.includes(`i.${role}{background:var(--cloud-${role})}`));
  }
  assert.doesNotMatch(css,/#7895ed|#d86da8|#355cba|#af176d/i);
  const row={e13:10,e21:20,s50:30,s200:40,f:false,m:false,o:false};
  assert.ok(cloudBands(row).every(b=>b.color===palette.pink));
  assert.ok(cloudSegments({...row,e13:20},row).every(b=>b.color===palette.pink));
});

test('symmetric family tone mapping is explicit, without glow or compositing tricks',()=>{
  const renderer=readFileSync(new URL('../chart-workshop/workshop.mjs',import.meta.url),'utf8');
  const bridge=readFileSync(new URL('../chart-workshop/station-bridge.mjs',import.meta.url),'utf8');
  const css=readFileSync(new URL('../chart-workshop/workshop.css',import.meta.url),'utf8');
  assert.match(renderer,/opacity\/100/);
  assert.match(renderer,/const ribbonInk=ribbonTone/);
  assert.match(bridge,/Math.sqrt/);
  assert.doesNotMatch(renderer,/globalCompositeOperation|shadowBlur|shadowColor|globalAlpha/);
  assert.doesNotMatch(css,/mix-blend-mode|filter:.*brightness/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {displayMetrics,indicatorStroke,endpointLabels,latestLabelsVisible,dailyOnIntraday,tenMinuteBars} from '../chart-workshop/layout.mjs';
import {specs} from '../chart-workshop/model.mjs';
test('intraday never receives its own future daily close',()=>{
  const daily=[{time:Date.parse('2026-09-16T04:00Z'),e13:10},{time:Date.parse('2026-09-17T04:00Z'),e13:20}];
  const bars=[{t:Date.parse('2026-09-17T14:00Z')},{t:Date.parse('2026-09-18T14:00Z')}];
  assert.deepEqual(dailyOnIntraday(daily,bars).map(r=>r.e13),[10,20]);
});
test('10-minute preview pairs contiguous bars, rejecting holes and trailing half bars',()=>{
  const bars=[0,1,2,4,5,6].map(i=>({t:6000000+i*300000,o:10,h:15,l:8,c:12,v:2}));
  const out=tenMinuteBars(bars);assert.equal(out.length,2);assert.ok(out.every(b=>b.v===4));
});
test('zooming out reduces strokes and type without changing the hierarchy',()=>{
  const near=displayMetrics(1200,700,35),far=displayMetrics(1200,700,700);
  assert.ok(near.scale>far.scale);assert.ok(near.font>far.font);
  assert.ok(far.scale>=.28);assert.ok(near.scale<=.85);
  assert.ok(near.font-far.font>3);
  for(const metrics of [near,far])for(const spec of specs)assert.ok(metrics.priceWidth>indicatorStroke(spec,metrics)*1.4);
  const e8=specs.find(spec=>spec.key==='e8'),e13=specs.find(spec=>spec.key==='e13');
  for(const metrics of [near,far])assert.ok(indicatorStroke(e8,metrics)<indicatorStroke(e13,metrics));
});
test('phone, six-pane and full pane labels fit and preserve exact level anchors',()=>{
  for(const width of [320,440,1200]){
    const metrics=displayMetrics(width,240,120);
    const input=[{y:45},{y:46},{y:47},{y:180},{y:181}];
    const rows=endpointLabels(input,{...metrics,width,endpointX:width-245});
    assert.equal(rows.length,5);
    for(let i=0;i<rows.length;i++){
      assert.equal(rows[i].anchorY,input[i].y);
      assert.ok(rows[i].x+rows[i].textWidth<=width-8);
      assert.equal(rows[i].y,input[i].y);
      if(i&&Math.abs(rows[i].y-rows[i-1].y)<29)assert.ok(rows[i].x>=rows[i-1].x+rows[i-1].textWidth);
    }
  }
});
test('isolated endpoint labels stay at the level and need no collision leader',()=>{
  const rows=endpointLabels([{y:40},{y:150}],{width:600,height:240,endpointX:350,labelWidth:140,gap:22});
  assert.deepEqual(rows.map(r=>r.y),[40,150]);assert.ok(rows.every(r=>!r.displaced));
  assert.deepEqual(rows.map(r=>r.x),[358,358]);
});
test('annotations disappear when the true latest observation leaves view',()=>{
  assert.equal(latestLabelsVisible({start:500,end:999},1000),true);
  assert.equal(latestLabelsVisible({start:500,end:998.9},1000),false);
  assert.equal(latestLabelsVisible({start:0,end:100},1000),false);
  assert.equal(latestLabelsVisible({start:0,end:0},0),false);
});
test('five coincident annotations compact horizontally without invented price offsets',()=>{
  for(const [width,endpointX] of [[900,650],[415,212.1]]){
    const rows=endpointLabels(Array.from({length:5},(_,i)=>({y:80,label:String(i)})),{width,height:400,endpointX,labelWidth:108,gap:25});
    assert.equal(rows.length,5);assert.ok(rows.every(r=>r.compact&&r.y===80&&r.anchorY===80));
    for(let i=1;i<rows.length;i++)assert.ok(rows[i].x>=rows[i-1].x+rows[i-1].textWidth);
    assert.ok(rows.at(-1).x+rows.at(-1).textWidth<=width-8);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {dayChange,ribbonTone,viewMessage,sharedView} from '../chart-workshop/station-bridge.mjs';
import quoteApi from '../api/cloud-workshop-quote.js';
const now=Date.parse('2026-09-21T16:00:00Z');
const q={symbol:'TSLA',price:105,previous_close:100,price_observation_utc:new Date(now).toISOString()};
test('Station percentage and palette are independent of visible bars and candle interval',()=>{
  assert.equal(dayChange(q,now).text,'5.00%');assert.equal(dayChange(q,now).color,'#00FFA3');
  assert.equal(dayChange({...q,price:95},now).text,'(5.00%)');assert.equal(dayChange({...q,price:95},now).color,'#FF2D55');
  assert.deepEqual(dayChange({...q,visibleClose:1,timeframe:'W'},now),dayChange(q,now));
});
test('no zero/null baseline substitution and stale quote is identifiable',()=>{
  for(const previous_close of [0,null,undefined,NaN,'100'])assert.equal(dayChange({...q,previous_close},now).text,'—');
  assert.equal(dayChange(q,now+91000).stale,true);assert.equal(dayChange(q,now).stale,false);
});
test('pink brightness preserved and all indigo bands remain distinct',()=>{
  assert.equal(ribbonTone('#FF00A8',22),'rgb(120,0,79)');
  const colors=[26,36,44].map(x=>ribbonTone('#3455FF',x));assert.equal(new Set(colors).size,3);
  assert.deepEqual(colors,['rgb(27,43,130)','rgb(31,51,153)','rgb(34,56,169)']);
});
test('Station message vocabulary round trips and rejects invalid ranges',()=>{
  const m=viewMessage('TSLA',now-86400000,now,true);assert.equal(m.sc,'chart-view');
  assert.deepEqual(sharedView({...m,type:'SCINTILLA_CHART_VIEW'}),{from:now-86400000,to:now,followLatest:true});
  assert.equal(sharedView({...m,type:'OTHER'}),null);assert.equal(sharedView({...m,type:'SCINTILLA_CHART_VIEW',to:'bad'}),null);
});
async function api(url,method='GET',payload={quotes:{TSLA:{...q,state:'OK'}}}){
  let sent;const handler=quoteApi.createHandler(async()=>new Response(JSON.stringify(payload)));
  const res={setHeader(){},end(body){sent={status:this.statusCode,body:JSON.parse(body)};}};
  await handler({url,method},res);return sent;
}
test('quote proxy preserves exact Station fields and rejects misidentified data',async()=>{
  const result=await api('/api/cloud-workshop-quote?symbol=TSLA');assert.equal(result.status,200);assert.equal(result.body.quote.previous_close,100);
  assert.equal((await api('/?symbol=TSLA','GET',{quotes:{TSLA:{...q,state:'OK',symbol:'AAPL'}}})).status,502);
});
test('quote proxy is bounded to one symbol and read-only',async()=>{
  for(const url of ['/?symbol=TSLA&symbol=AAPL','/?symbol=TSLA&url=evil','/?symbol=../'])assert.equal((await api(url)).status,400);
  assert.equal((await api('/?symbol=TSLA','POST')).status,405);
});

// Persistent geometry is independent of the display candles. Bar-index slopes
// are evaluated on the ORIGINAL source timeline, including its trading sessions.
export function sourceIndex(bars,t){
  if(bars.length<2||t<bars[0].t||t>bars.at(-1).t)return null;
  let lo=0,hi=bars.length-1;while(lo+1<hi){let m=(lo+hi)>>1;if(bars[m].t<=t)lo=m;else hi=m;}
  return bars[lo].i+(bars[hi].i-bars[lo].i)*(t-bars[lo].t)/(bars[hi].t-bars[lo].t);
}
export function railValue(rail,bars,t){const i=sourceIndex(bars,t);if(i===null||rail.i1===rail.i2)return null;const a=rail.scale==='log'?Math.log(rail.p1):rail.p1,b=rail.scale==='log'?Math.log(rail.p2):rail.p2;const v=a+(b-a)*(i-rail.i1)/(rail.i2-rail.i1);return rail.scale==='log'?Math.exp(v):v;}
export function proximity(rail,bars,t,price,tolerancePct=.25){const value=railValue(rail,bars,t);if(value===null||!Number.isFinite(value)||value<=0||price<=0)return null;return {id:rail.id,sourceTF:rail.sourceTF,role:rail.role,value,distancePct:100*(value-price)/price,near:Math.abs(value-price)/price*100<=tolerancePct,continuation:t>rail.t2,knownAt:rail.confirmedAt??null};}
export function screen(registry,t,price){return registry.captures.flatMap(c=>c.rails.filter(r=>t>=r.t1).map(r=>proximity(r,c.sourceBars,t,price)).filter(Boolean)).sort((a,b)=>Math.abs(a.distancePct)-Math.abs(b.distancePct));}
export function projectedPoints(rail,bars){return bars.filter(b=>b.t>=rail.t1).map(b=>({t:b.t,p:railValue(rail,bars,b.t),continuation:b.t>rail.t2}));}
// This fixture is 24/7 BTC, not an exchange-calendar aggregation for equities.
export function displayCapture(bars,tf){
  if(tf==='240')return bars.map(b=>({...b}));
  if(!['D','W'].includes(tf))throw Error('Capture display supports 4H, Daily or Weekly only');
  const out=[];let active;
  for(const bar of bars){const day=Math.floor(bar.t/86400000),key=tf==='D'?day:Math.floor((day+3)/7);
    if(!active||active.key!==key){active={...bar,key};out.push(active);}else{active.h=Math.max(active.h,bar.h);active.l=Math.min(active.l,bar.l);active.c=bar.c;active.v+=bar.v;}}
  return out;
}

// Source-bar calculations. No display-timeframe resampling or future observations.
export const contexts=['180','240','6h','8h','12h','D','2D','3D','W','2W'];
export const names=['3H','4H','6H','8H','12H','D','2D','3D','W','2W'];
export function sma(a,n){return a.map((_,i)=>i<n-1||a.slice(i-n+1,i+1).some(v=>!Number.isFinite(v))?null:a.slice(i-n+1,i+1).reduce((s,v)=>s+v,0)/n);}
export function ema(a,n){let v=null,count=0;return a.map(x=>{if(!Number.isFinite(x)){v=null;count=0;return null;}v=v===null?x:v+2/(n+1)*(x-v);return ++count>=n?v:null;});}
export function calculate(bars){
  const close=bars.map(b=>b.c),raw=bars.map((b,i)=>{if(i<13)return null;const w=bars.slice(i-13,i+1),hi=Math.max(...w.map(b=>b.h)),lo=Math.min(...w.map(b=>b.l));return hi===lo?null:100*(b.c-lo)/(hi-lo);});
  let up=0,down=0;
  const rsi=close.map((v,i)=>{if(!i)return null;const d=v-close[i-1];if(i<=14){up+=Math.max(d,0)/14;down+=Math.max(-d,0)/14;}else{up=(13*up+Math.max(d,0))/14;down=(13*down+Math.max(-d,0))/14;}return i<14?null:down===0?(up===0?null:100):100-100/(1+up/down);});
  const k=sma(raw,3),d=sma(k,3),signal=sma(rsi,14),a=ema(close,12),b=ema(close,26),macd=a.map((v,i)=>Number.isFinite(v)&&Number.isFinite(b[i])?v-b[i]:null),macdSignal=ema(macd,9),volumeMean=sma(bars.map(b=>b.v),20);
  // A source value is first visible at the next supplied source-bar open.
  // The last source bar is withheld because its close/confirmation is not known here.
  return bars.slice(0,-1).map((bar,i)=>({t:bars[i+1].t,sourceTime:bar.t,rsi:rsi[i],signal:signal[i],w:raw[i],k:k[i],d:d[i],macd:macd[i],macdSignal:macdSignal[i],hist:Number.isFinite(macd[i])&&Number.isFinite(macdSignal[i])?macd[i]-macdSignal[i]:null,rvol:volumeMean[i]>0?bar.v/volumeMean[i]:null}));
}
export function atOrBefore(rows,t){let lo=0,hi=rows.length;while(lo<hi){let m=(lo+hi)>>1;if(rows[m].t<=t)lo=m+1;else hi=m;}return rows[lo-1]||null;}
export function lineStyle(rank,span=180){const z=Math.max(.8,Math.min(1.3,Math.sqrt(180/Math.max(8,span))));return {width:(.7+rank*.19)*z,alpha:.3+rank*.065,font:Math.round(10+z*2)};}
export function signalEnvelope(fans,t){const a=fans.map(f=>atOrBefore(f.rows,t)?.signal).filter(Number.isFinite).sort((a,b)=>a-b);return a.length<2?null:{lo:a[Math.floor((a.length-1)*.25)],hi:a[Math.ceil((a.length-1)*.75)],n:a.length};}

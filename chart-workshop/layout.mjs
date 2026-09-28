export function labelLayout(items, height, gap = 25, inset = 17) {
  const rows = items.filter(x => Number.isFinite(x.y)).map(x => ({ ...x, anchorY: x.y })).sort((a,b) => a.y-b.y);
  const spacing = Math.min(gap, Math.max(0,(height-2*inset)/Math.max(1,rows.length-1)));
  rows.forEach((row,i) => {row.y=Math.max(inset,Math.min(height-inset,row.y),i ? rows[i-1].y+spacing : inset);});
  if(rows.length && rows.at(-1).y>height-inset){rows.at(-1).y=height-inset;for(let i=rows.length-2;i>=0;i--)rows[i].y=Math.min(rows[i].y,rows[i+1].y-spacing);}
  return rows;
}
export function aggregateCandles(series, timeframe, asof = Infinity) {
  // A historical pane must never borrow later sessions into its final aggregate.
  const available = series.filter(bar => bar.t <= asof);
  if(timeframe==='D')return available;
  const out=[];let active;
  for(let i=0;i<available.length;i++){
    const bar=available[i]; const date=new Date(bar.t);
    // Three-day preview uses consecutive provider sessions; not an exchange calendar claim.
    const key=timeframe==='3D'?Math.floor(i/3):Math.floor((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())+3*86400000)/(7*86400000));
    if(!active||active.key!==key){active={...bar,key};out.push(active);}else{active.h=Math.max(active.h,bar.h);active.l=Math.min(active.l,bar.l);active.c=bar.c;active.v+=bar.v;}
  }
  return out;
}
export const signedPercent=(value,price)=>Number.isFinite(value)&&Number.isFinite(price)&&price!==0?100*(value/price-1):null;

/** Display pixels only: never changes periods, prices or cloud geometry. */
export function displayMetrics(width, height, candleCount) {
  const compact=width<650;
  const plotWidth=Math.max(60,width-24);
  const spacing=plotWidth/Math.max(1,candleCount);
  const zoom=Math.max(0,Math.min(1,Math.log2(Math.max(1,spacing))/5));
  const scale=.28+.57*zoom;
  const font=10+(compact?4:7)*zoom;
  const labelWidth=Math.max(108,font*9);
  const priceWidth=3.8+1.2*zoom;
  return {labelWidth,plotWidth,scale,font,priceWidth,gap:Math.max(29,font*2.6),height};
}

export const indicatorStroke=(spec,metrics)=>Math.max(spec.key==='e8'?.32:.45,spec.width*metrics.scale);

/** Annotation belongs to the actual latest observation, never a historical edge. */
export const latestLabelsVisible=(view,count)=>count>0&&view.start<=count-1&&view.end>=count-1-.001;

/** Exact price-height annotations. Nearby labels use compact horizontal lanes,
 * never artificial vertical prices or a full-height axis. Hover retains details. */
export function endpointLabels(items, {width,height,endpointX,labelWidth,gap,font=11}) {
  const rows=items.filter(r=>Number.isFinite(r.y)&&r.y>=18&&r.y<=height-18).map(r=>({...r,anchorY:r.y}));
  const placed=[];
  for(const row of rows){
    const compact=rows.some(other=>other!==row&&Math.abs(other.y-row.y)<Math.max(29,gap));
    const textWidth=compact?Math.max(width<500?32:40,(font+1.2)*2.4):labelWidth;
    let x=endpointX+8;
    for(const other of placed)if(Math.abs(other.y-row.y)<Math.max(29,gap)&&x<other.x+other.textWidth+3)x=other.x+other.textWidth+3;
    if(x+textWidth>width-8)continue;
    placed.push({...row,x,textWidth,compact,displaced:false});
  }
  return placed;
}

const sessionFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
const sessionDate=t=>sessionFormatter.format(t);
/** Intraday preview uses the prior completed daily session, never that day's future close. */
export function dailyOnIntraday(daily,bars) {
  let i=-1;
  return bars.flatMap(bar=>{
    while(i+1<daily.length&&sessionDate(daily[i+1].time)<sessionDate(bar.t))i++;
    return i<0?[]:[{...daily[i],time:bar.t,sourceTime:daily[i].time}];
  });
}
/** Stable cross-timeframe display: a completed daily observation is anchored at
 * the next supplied session, conservatively avoiding same-day future-close use.
 * Connecting historical anchors is geometry only, never a new computed sample. */
export function dailyCurveAnchors(daily,through=Infinity) {
  const rows=daily.slice(0,-1).map((row,i)=>({...row,sourceTime:row.time,time:daily[i+1].time})).filter(row=>row.time<=through);
  // Carry the last known value to the visible price endpoint, so labels stay to
  // the right of price rather than inside its latest intraday bars.
  if(Number.isFinite(through)&&rows.length&&rows.at(-1).time<through)rows.push({...rows.at(-1),time:through,displayOnly:true});
  return rows;
}
/** Only complete, contiguous pairs. Never fill missing five-minute provider bars. */
export function tenMinuteBars(bars) {
  const out=[];
  for(let i=0;i<bars.length-1;i++){
    const a=bars[i],b=bars[i+1];
    if(a.t%600000===0&&b.t===a.t+300000){out.push({...a,h:Math.max(a.h,b.h),l:Math.min(a.l,b.l),c:b.c,v:a.v+b.v});i++;}
  }
  return out;
}

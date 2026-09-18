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

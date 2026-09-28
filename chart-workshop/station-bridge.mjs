// Station's public chart-view message shape and day-change semantics.
// No dependence on visible range, selected candle timeframe or MA state.
export const priceColors = Object.freeze({up:'#00FFA3',down:'#FF2D55',flat:'#8797aa'});
export function dayChange(quote, now=Date.now()) {
  const price=quote?.price, previous=quote?.previous_close;
  const valid=typeof price==='number'&&Number.isFinite(price)&&price>0&&typeof previous==='number'&&Number.isFinite(previous)&&previous>0;
  const pct=valid?(price-previous)/previous*100:null;
  const tone=pct===null||Math.abs(pct)<.005?'flat':pct>0?'up':'down';
  const observed=Date.parse(quote?.price_observation_utc);
  return {pct,tone,color:priceColors[tone],text:pct===null?'—':Math.abs(pct)<.005?'0.00%':pct>0?pct.toFixed(2)+'%':'('+Math.abs(pct).toFixed(2)+'%)',
    stale:!Number.isFinite(observed)||now-observed>90000||observed>now+60000};
}
export function ribbonTone(hex,opacity) {
  const gain=Math.sqrt(Math.max(0,Math.min(100,opacity))/100);
  return `rgb(${[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*gain)).join(',')})`;
}
// Perceptual separation on black is intentionally independent of stored alpha.
// Small review adjustment: pink intensity -6%; faint indigo gain .26 -> .23.
// No alpha, indicator, or global Station palette change.
export function cloudInk(band) {
  const gain=band.bullish?{fast:.85,middle:.53,slow:.23}[band.layer]:Math.sqrt(band.opacity/100)*.94;
  return `rgb(${[1,3,5].map(i=>Math.round(parseInt(band.color.slice(i,i+2),16)*gain)).join(',')})`;
}
export function viewMessage(ticker,from,to,followLatest) {
  return {sc:'chart-view',ticker,from:new Date(from).toISOString(),to:new Date(to).toISOString(),followLatest};
}
export function sharedView(message) {
  if(message?.type!=='SCINTILLA_CHART_VIEW')return null;
  const from=Date.parse(message.from),to=Date.parse(message.to);
  return Number.isFinite(from)&&Number.isFinite(to)&&to>from?{from,to,followLatest:message.followLatest===true}:null;
}

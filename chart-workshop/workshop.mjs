import {computeAverages,cloudPolygons,normalizeEnvelope,palette,specs,COMPUTATION_CONTRACT} from './model.mjs';
import {endpointLabels,latestLabelsVisible,displayMetrics,indicatorStroke,aggregateCandles,signedPercent,dailyCurveAnchors,tenMinuteBars} from './layout.mjs';
import {dayChange,priceColors,ribbonTone,cloudInk,viewMessage,sharedView} from './station-bridge.mjs';
import {traceStation,clampView,timeIndex,indexTime,viewForTimes,wireStationGestures} from './station-renderer.mjs';
const $=s=>document.querySelector(s), day=86400000;
// One scoped hue source for canvas geometry, caption text, and the local legend.
for(const [role,color]of Object.entries(palette))document.documentElement.style.setProperty(`--cloud-${role}`,color);
let envelope, averages=[], panes=[], generation=0, quote=null, quoteRequest=0;
const intradayMinutes={'10m':10,'15':15,'60':60,'240':240};
const isIntraday=tf=>Object.hasOwn(intradayMinutes,tf);
const money=n=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const signed=n=>n===null?'n/a':(n>0?'+':n<0?'−':'')+Math.abs(n).toFixed(1)+'%';
const dateLabel=t=>new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit',timeZone:'America/New_York'});
function rgba(hex,opacity){return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${opacity/100})`;}
// Display-only tone mapping; indicator values are never changed by appearance.
const ribbonInk=ribbonTone;
async function refreshQuote(){
  const symbol=loadedSymbol(),request=++quoteRequest;if(!symbol)return;
  try{const response=await fetch(`/api/cloud-workshop-quote?symbol=${encodeURIComponent(symbol)}`);
    if(!response.ok)throw new Error('Quote unavailable');const data=await response.json();
    if(request!==quoteRequest||symbol!==loadedSymbol())return;
    if(data.symbol!==symbol||data.quote?.symbol!==symbol)throw new Error('Quote identity mismatch');
    quote=data.quote;
  }catch{if(request!==quoteRequest||symbol!==loadedSymbol())return;quote=null;}
  panes.forEach(p=>p.draw());
}
function coordinateView(source){
  const msg=viewMessage(loadedSymbol(),source.end-source.span,source.end,source.end>=(source.intraday?.series||envelope.series).at(-1).t);
  if($('#syncViews').checked)for(const p of panes)if(p!==source)p.applyTimes(source.end-source.span,source.end);
  if(window.parent!==window)window.parent.postMessage(msg,location.origin);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==window.parent)return;
  const view=sharedView(event.data);if(!view||!envelope)return;
  for(const p of panes)p.applyTimes(view.from,view.to);
});
function activeSpecs(){return specs.filter(s=>s.key!=='s100'||$('#level100').checked);}
function selectedSymbol(){return $('#symbol').value.trim().toUpperCase();}
function loadedSymbol(){return envelope?.symbol || '';}
async function load(){
  const symbol=selectedSymbol();
  if(!/^[A-Z][A-Z0-9.\-]{0,15}$/.test(symbol)){$('#status').textContent='Enter an equity symbol such as TSLA or GOOGL.';return;}
  const token=++generation;
  quote=null;++quoteRequest;
  $('#status').textContent=`Loading ${symbol} · actual provider daily bars…`;$('#load').disabled=true;
  try{
    const endpoint=['127.0.0.1','localhost'].includes(location.hostname)?'/workshop-data':'/api/cloud-workshop-candles';
    const response=await fetch(`${endpoint}?symbol=${encodeURIComponent(symbol)}&tf=D&limit=1200`);
    if(!response.ok)throw new Error(`Provider request failed (${response.status})`);
    const raw=await response.json();if(token!==generation)return;
    const next=normalizeEnvelope(raw);
    if(next.symbol!==symbol||next.tf!=='D')throw new Error('Provider data identity does not match the requested daily symbol.');
    if(next.series.length<201)throw new Error(`Only ${next.series.length} daily bars returned; 200D needs more history.`);
    const nextAverages=computeAverages(next.series);
    envelope=next;averages=nextAverages;
    const last=envelope.series.at(-1);
    $('#status').textContent=`${symbol} · ${envelope.series.length.toLocaleString()} provider daily bars · last ${dateLabel(last.t)} · ${money(last.c)} · parity pending`;
    $('#source').textContent=JSON.stringify(envelope.provenance,null,2);
    $('#source').style.whiteSpace='pre-wrap';createPanes();refreshQuote();
  }catch(error){if(token!==generation)return;envelope=null;averages=[];for(const p of panes)p.dispose();panes=[];$('#grid').replaceChildren();$('#source').textContent='';$('#status').textContent=error.message;const note=document.createElement('p');note.className='error';note.textContent='No chart drawn. The feed is unavailable or insufficient; no substitute data was used.';$('#grid').append(note);}
  finally{if(token===generation)$('#load').disabled=false;}
}
function createPanes(){
  if(!envelope)return;for(const p of panes)p.dispose();panes=[];$('#grid').replaceChildren();
  const six=$('#layout').value==='6';$('#grid').classList.toggle('six',six);
  const configs=six?[['D',120],['3D',240],['W',420],['D',240],['3D',420],['W',700]]:[['D',300]];
  for(const [tf,span]of configs)panes.push(new Pane(tf,span));
}
class Pane{
  async changeTimeframe(tf){
    const from=this.end-this.span,to=this.end,atLatest=this.view?.end>=this.allBars().length-1-.01;
    this.tf=tf;this.intraday=null;const request=this.request=(this.request||0)+1;
    if(!isIntraday(tf)){this.applyTimes(from,atLatest?this.allBars().at(-1).t:to);return;}
    this.el.querySelector('.range').hidden=false;this.el.querySelector('.range').textContent='Loading candles…';
    this.labels.replaceChildren();this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    const symbol=loadedSymbol();
    try{
      const endpoint=['127.0.0.1','localhost'].includes(location.hostname)?'/workshop-data':'/api/cloud-workshop-candles';
      const sourceTF=tf==='10m'?'5m':tf;
      const response=await fetch(`${endpoint}?symbol=${encodeURIComponent(symbol)}&tf=${sourceTF}&limit=1200`);
      if(!response.ok)throw new Error(`Candles unavailable (${response.status})`);
      const data=normalizeEnvelope(await response.json());
      if(data.symbol!==symbol||data.tf!==sourceTF)throw new Error('Candle identity mismatch');
      if(request!==this.request||!this.el.isConnected)return;
      this.intraday={...data,series:tf==='10m'?tenMinuteBars(data.series):data.series};
      if(!this.intraday.series.length)throw new Error('No complete candles returned');
      this.applyTimes(from,atLatest?this.intraday.series.at(-1).t:to);
    }catch(error){if(request!==this.request||!this.el.isConnected)return;this.intraday=null;this.el.querySelector('.range').hidden=false;this.el.querySelector('.range').textContent=error.message;}
  }
  constructor(tf,span){
    this.tf=tf;this.span=span*day;this.end=envelope.series.at(-1).t+2*day;
    this.el=document.createElement('section');this.el.className='pane';
this.el.innerHTML='<div class="pane-head"><strong></strong><span class="day-change"></span><span class="quote-state"></span><select aria-label="Candle timeframe"><option value="10m">10m · paired 5m</option><option value="15">15m</option><option value="60">1h</option><option value="240">4h</option><option value="D">Daily</option><option value="3D">3 sessions</option><option value="W">Weekly</option></select><span class="range" hidden></span></div><div class="stage"><canvas aria-label="Price and daily-locked moving-average ribbon"></canvas><div class="labels"></div><div class="pane-readout"></div></div>';
    this.el.querySelector('strong').textContent=loadedSymbol();const sel=this.el.querySelector('select');sel.value=tf;sel.onchange=()=>this.changeTimeframe(sel.value);
    this.stage=this.el.querySelector('.stage');this.canvas=this.el.querySelector('canvas');this.labels=this.el.querySelector('.labels');this.ctx=this.canvas.getContext('2d');$('#grid').append(this.el);
    this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(this.stage);
    this.canvas.tabIndex=0;
    this.unwire=wireStationGestures(this.canvas,{getView:()=>this.view||{start:0,end:1},getCount:()=>this.allBars().length,getWidth:()=>this.plotWidth,
      setView:v=>{this.setView(v);coordinateView(this);},hover:(x,y)=>this.hover(x,y),clearHover:()=>{this.el.querySelector('.pane-readout').textContent='';},reset:()=>{this.reset();coordinateView(this);}});
    this.applyTimes(this.end-this.span,this.end);
  }
  allBars(){return isIntraday(this.tf)?this.intraday?.series||[]:aggregateCandles(envelope.series,this.tf);}
  applyTimes(from,to){const bars=this.allBars();if(bars.length<2)return;this.setView(viewForTimes(bars,from,to));}
  setView(view){const bars=this.allBars();if(bars.length<2)return;this.view=clampView(view,bars.length);this.end=indexTime(bars,this.view.end);this.span=this.end-indexTime(bars,this.view.start);this.draw();}
  reset(){const bars=this.allBars();if(bars.length>1)this.setView({start:Math.max(0,bars.length-201),end:bars.length-1});}
  dispose(){this.request=(this.request||0)+1;this.unwire?.();this.resize.disconnect();this.el.remove();}
hover(px){if(!this.x||!this.displayBars?.length)return;const nearest=this.displayBars.reduce((a,b)=>Math.abs(this.x(b.t)-px)<Math.abs(this.x(a.t)-px)?b:a);this.el.querySelector('.pane-readout').textContent=`${isIntraday(this.tf)?`${intradayMinutes[this.tf]}m`:this.tf==='D'?'Daily':this.tf==='W'?'Weekly preview':'3-session preview'} ${dateLabel(nearest.t)}  O ${money(nearest.o)}  H ${money(nearest.h)}  L ${money(nearest.l)}  C ${money(nearest.c)}`;}
  draw(){
    const width=this.stage.clientWidth,height=this.stage.clientHeight;if(width<50||height<50||!envelope||(isIntraday(this.tf)&&!this.intraday))return;
    const sourceBars=this.allBars();if(sourceBars.length<2)return;
    if(!this.view)this.view=viewForTimes(sourceBars,this.end-this.span,this.end);
    const view=clampView(this.view,sourceBars.length);
    const dailyState=dayChange(quote);
    const header=this.el.querySelector('.pane-head');header.style.setProperty('--day-color',dailyState.color);
    header.querySelector('.day-change').textContent=dailyState.text;
    const quoteState=header.querySelector('.quote-state');const quoteAt=Date.parse(quote?.price_observation_utc);quoteState.textContent=!quote?'quote unavailable':!Number.isFinite(quoteAt)?'quote time unknown':dailyState.stale?'as of '+new Date(quoteAt).toLocaleString():'';
    quoteState.title='Day change uses the provider quote versus previous regular-session close; it does not follow chart zoom.';
    const daySpan=isIntraday(this.tf)?intradayMinutes[this.tf]/1440:this.tf==='D'?1:this.tf==='3D'?4.3:7;
    const metrics=displayMetrics(width,height,view.end-view.start);
    this.plotWidth=metrics.plotWidth;this.labels.style.width='100%';
    this.el.dataset.strokeScale=String(metrics.scale);
    const dpr=devicePixelRatio||1;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);const c=this.ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
    this.start=indexTime(sourceBars,view.start);this.end=indexTime(sourceBars,view.end);this.span=this.end-this.start;
    const showLatestLabels=latestLabelsVisible(view,sourceBars.length);
    const annotationSpace=showLatestLabels?Math.min(Math.max(245,(metrics.font+1.2)*2.4*activeSpecs().length+24),width*.50):12;
    const rightBars=Math.max(2,(view.end-view.start)*annotationSpace/Math.max(60,this.plotWidth-annotationSpace));
    this.x=t=>12+(timeIndex(sourceBars,t)-view.start)/(view.end-view.start+rightBars)*this.plotWidth;const x=this.x;
    const bars=sourceBars.slice(Math.max(0,Math.floor(view.start)),Math.ceil(view.end)+1);
    this.displayBars=bars;
    // One native-daily geometry on EVERY price interval. Joining historical daily
    // anchors is a display curve, not interpolated indicator observations or signals.
    const anchors=dailyCurveAnchors(averages,this.end),first=anchors.findIndex(r=>r.time>=this.start);
    const left=first<0?Math.max(0,anchors.length-1):Math.max(0,first-1);
    const rows=anchors.slice(left).filter(r=>r.time<=this.end);const latest=rows.at(-1);
    if(!bars.length||!latest){this.labels.replaceChildren();return;}
    const visible=bars.filter(b=>b.t>=this.start);const values=visible.flatMap(b=>$('#priceStyle').value==='line'?[b.c]:[b.l,b.h]);
    let lo=Math.min(...values),hi=Math.max(...values),range=hi-lo||1;lo-=range*.055;hi+=range*.055;const y=p=>18+(hi-p)/(hi-lo)*(height-48);
    c.font='10px -apple-system,sans-serif';c.textBaseline='middle';c.fillStyle='#566779';c.strokeStyle='#14202c';c.lineWidth=.5;
    for(let i=1;i<5;i++){const yy=18+(height-48)*i/5;c.beginPath();c.moveTo(12,yy);c.lineTo(12+this.plotWidth,yy);c.stroke();c.fillText(money(hi-(hi-lo)*i/5),16,yy-7);}
    c.save();c.beginPath();c.rect(11,5,this.plotWidth+2,height-24);c.clip();
    if($('#clouds').checked){for(let i=1;i<rows.length;i++){
      const a=rows[i-1],b=rows[i];
for(const v of cloudPolygons(a,b)){const xa=x(a.time)+(x(b.time)-x(a.time))*v.t0,xb=x(a.time)+(x(b.time)-x(a.time))*v.t1;c.fillStyle=cloudInk(v);c.beginPath();c.moveTo(xa,y(v.previousLo));c.lineTo(xb,y(v.lo));c.lineTo(xb,y(v.hi));c.lineTo(xa,y(v.previousHi));c.closePath();c.fill();}
    }}
    if($('#lines').checked)for(const s of activeSpecs()){
      c.lineWidth=indicatorStroke(s,metrics);c.setLineDash(s.style==='dashed'?(s.key==='e8'?[3,5]:[5,5]):[]);
      for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];if(!Number.isFinite(a[s.key])||!Number.isFinite(b[s.key]))continue;const close=envelope.series.find(p=>p.t===b.sourceTime)?.c;const bull=s.stateKey==='price'?close>=b[s.key]:b[s.stateKey];c.strokeStyle=ribbonInk(bull?palette.blue:palette.pink,bull?s.blueOpacity:s.pinkOpacity);c.beginPath();c.moveTo(x(a.time),y(a[s.key]));c.lineTo(x(b.time),y(b[s.key]));c.stroke();}
    }
    c.setLineDash([]);const body=Math.min(13,Math.max(1.1,this.plotWidth/(view.end-view.start+rightBars)*.65));
    if($('#priceStyle').value==='line'){
      c.strokeStyle=dailyState.color;c.lineWidth=metrics.priceWidth;c.lineJoin='round';c.lineCap='round';c.beginPath();
      traceStation(c,bars.map(b=>({x:x(b.t),y:y(b.c)})));c.stroke();
      const last=bars.at(-1);c.beginPath();c.arc(x(last.t),y(last.c),3,0,Math.PI*2);c.fillStyle=dailyState.color;c.fill();
    }else for(const b of bars){const xx=x(b.t);c.strokeStyle=b.c>=b.o?priceColors.up:priceColors.down;c.fillStyle=c.strokeStyle;c.lineWidth=1;c.beginPath();c.moveTo(xx,y(b.h));c.lineTo(xx,y(b.l));c.stroke();if($('#priceStyle').value==='bars'){c.beginPath();c.moveTo(xx-body/2,y(b.o));c.lineTo(xx,y(b.o));c.moveTo(xx,y(b.c));c.lineTo(xx+body/2,y(b.c));c.stroke();}else c.fillRect(xx-body/2,Math.min(y(b.o),y(b.c)),body,Math.max(1,Math.abs(y(b.o)-y(b.c))));}
    c.restore();c.setLineDash([]);
    const reference=bars.at(-1).c;
    const labelRows=showLatestLabels?endpointLabels(activeSpecs().filter(s=>Number.isFinite(latest[s.key])&&y(latest[s.key])>=18&&y(latest[s.key])<=height-30).map(s=>({...s,y:y(latest[s.key]),value:latest[s.key]})),{width,height:height-25,endpointX:x(sourceBars.at(-1).t),labelWidth:metrics.labelWidth,gap:metrics.gap,font:metrics.font}):[];
    this.labels.replaceChildren();
for(const row of labelRows){const bull=reference>=row.value;const node=document.createElement('div');node.className=`end-label ${bull?'blue':'pink'}${row.compact?' compact':''}`;node.style.top=`${row.y}px`;node.style.left=`${row.x}px`;node.style.width=`${row.textWidth}px`;node.style.setProperty('--label-size',`${metrics.font+row.width*.3}px`);node.dataset.anchorPrice=String(row.value);node.dataset.anchorY=String(row.anchorY);node.dataset.textY=String(row.y);node.title=`${row.label} ${row.kind}: ${money(row.value)} · ${signed(signedPercent(row.value,reference))} from latest loaded close. Exact line height; nearby labels compact horizontally.`;node.setAttribute('aria-label',node.title);for(const [tag,cl,txt]of[['b','',row.label],['span','pct',`(${signed(signedPercent(row.value,reference))})`],['span','price',money(row.value)]]){const n=document.createElement(tag);n.className=cl;n.textContent=txt;node.append(n);}this.labels.append(node);
      if(row.displaced){c.strokeStyle=rgba(bull?palette.blue:palette.pink,55);c.lineWidth=.6;c.beginPath();c.moveTo(x(latest.time),row.anchorY);c.lineTo(row.x-5,row.y);c.stroke();}
      c.fillStyle=bull?palette.blue:palette.pink;c.beginPath();c.arc(x(latest.time),row.anchorY,1.5,0,Math.PI*2);c.fill();
    }
    c.font='10px -apple-system,sans-serif';c.fillStyle='#718398';c.textBaseline='bottom';const tickCount=Math.max(2,Math.min(4,Math.floor(this.plotWidth/100)));for(let i=0;i<tickCount;i++){const fraction=i/(tickCount-1);const t=this.start+this.span*fraction;c.fillText(dateLabel(t),x(t)-fraction*62,height-5);}
    this.el.querySelector('.range').hidden=true;this.el.querySelector('.range').textContent=`${(this.span/day).toFixed(this.span<day?1:0)}d · through ${dateLabel(sourceBars.at(-1).t)}`;
    this.el.dataset.referenceClose=String(reference);this.el.dataset.referenceTime=String(latest.time);
    this.el.dataset.visibleRows=String(rows.length);this.el.dataset.timeframe=this.tf;
    this.el.dataset.viewStart=String(view.start);this.el.dataset.viewEnd=String(view.end);
    this.el.dataset.latestLabels=String(showLatestLabels);
    this.el.dataset.priceWidth=String(metrics.priceWidth);this.el.dataset.labelFont=String(metrics.font);
  }
}
$('#controls').onsubmit=e=>{e.preventDefault();load();};$('#layout').onchange=createPanes;for(const id of ['level100','clouds','lines','priceStyle'])$('#'+id).onchange=()=>panes.forEach(p=>p.draw());$('#reset').onclick=()=>panes.forEach(p=>p.reset());
$('#export').onclick=()=>{if(!envelope)return;const twin={schema:'scintilla.cloud-workshop.v1',createdAt:new Date().toISOString(),symbol:loadedSymbol(),validation:'NOT_PARITY_CERTIFIED',computation:COMPUTATION_CONTRACT,provenance:envelope.provenance,raw:envelope.series,averages,specs,view:panes.map(p=>({tf:p.tf,start:p.start,end:p.end,percentageReference:'LAST_VISIBLE_PRICE_BAR_CLOSE',intraday:p.intraday||null,dailyMapping:'CONFIRMED_NEXT_SESSION_ANCHORS',curve:'STRAIGHT_JOINS_BETWEEN_DAILY_ANCHORS_DISPLAY_ONLY',referenceTime:Number(p.el.dataset.referenceTime),referenceClose:Number(p.el.dataset.referenceClose)})),optional100:$('#level100').checked};const url=URL.createObjectURL(new Blob([JSON.stringify(twin,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`scintilla-cloud-workshop-${loadedSymbol()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
load();
setInterval(()=>{if(!document.hidden)refreshQuote();},60000);

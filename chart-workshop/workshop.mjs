import {computeAverages,cloudBands,normalizeEnvelope,palette,specs,COMPUTATION_CONTRACT} from './model.mjs';
import {labelLayout,aggregateCandles,signedPercent} from './layout.mjs';
const $=s=>document.querySelector(s), day=86400000;
let envelope, averages=[], panes=[], generation=0;
const money=n=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const signed=n=>n===null?'n/a':(n>0?'+':n<0?'−':'')+Math.abs(n).toFixed(1)+'%';
const dateLabel=t=>new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit',timeZone:'America/New_York'});
function rgba(hex,opacity){return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${opacity/100})`;}
function activeSpecs(){return specs.filter(s=>s.key!=='s100'||$('#level100').checked);}
function selectedSymbol(){return $('#symbol').value.trim().toUpperCase();}
function loadedSymbol(){return envelope?.symbol || '';}
async function load(){
  const symbol=selectedSymbol();
  if(!/^[A-Z][A-Z0-9.\-]{0,15}$/.test(symbol)){$('#status').textContent='Enter an equity symbol such as TSLA or GOOGL.';return;}
  const token=++generation;
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
    $('#source').style.whiteSpace='pre-wrap';createPanes();
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
  constructor(tf,span){
    this.tf=tf;this.span=span*day;this.end=envelope.series.at(-1).t+2*day;
    this.el=document.createElement('section');this.el.className='pane';
    this.el.innerHTML='<div class="pane-head"><strong></strong><select aria-label="Candle timeframe"><option value="D">Daily</option><option value="3D">3 sessions</option><option value="W">Weekly</option></select><span class="range"></span></div><div class="stage"><canvas aria-label="Candles and daily-locked moving-average ribbon"></canvas><div class="labels"></div><div class="pane-readout"></div></div>';
    this.el.querySelector('strong').textContent=loadedSymbol();const sel=this.el.querySelector('select');sel.value=tf;sel.onchange=()=>{this.tf=sel.value;this.draw();};
    this.stage=this.el.querySelector('.stage');this.canvas=this.el.querySelector('canvas');this.labels=this.el.querySelector('.labels');this.ctx=this.canvas.getContext('2d');$('#grid').append(this.el);
    this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(this.stage);
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.span=Math.max(25*day,Math.min(1400*day,this.span*Math.exp(e.deltaY*.0015)));this.draw();},{passive:false});
    this.canvas.addEventListener('pointerdown',e=>{this.drag={x:e.offsetX,end:this.end};this.canvas.setPointerCapture(e.pointerId);});
    this.canvas.addEventListener('pointermove',e=>{if(this.drag){this.end=Math.min(envelope.series.at(-1).t+2*day,Math.max(envelope.series[200].t+30*day,this.drag.end-(e.offsetX-this.drag.x)*this.span/Math.max(1,this.plotWidth)));this.draw();}else this.hover(e.offsetX);});
    this.canvas.addEventListener('pointerup',()=>this.drag=null);this.canvas.addEventListener('pointercancel',()=>this.drag=null);this.canvas.addEventListener('pointerleave',()=>this.el.querySelector('.pane-readout').textContent='');
  }
  dispose(){this.resize.disconnect();this.el.remove();}
  hover(px){if(!this.x||!this.displayBars?.length)return;const target=this.start+(px-12)/this.plotWidth*this.span;const nearest=this.displayBars.reduce((a,b)=>Math.abs(b.t-target)<Math.abs(a.t-target)?b:a);this.el.querySelector('.pane-readout').textContent=`${this.tf==='D'?'Daily':this.tf==='W'?'Weekly preview':'3-session preview'} ${dateLabel(nearest.t)}  O ${money(nearest.o)}  H ${money(nearest.h)}  L ${money(nearest.l)}  C ${money(nearest.c)}`;}
  draw(){
    const width=this.stage.clientWidth,height=this.stage.clientHeight;if(width<50||height<50||!envelope)return;
    const gutter=width>650?195:158;this.plotWidth=Math.max(60,width-gutter-18);this.labels.style.width=`${gutter-15}px`;
    const dpr=devicePixelRatio||1;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);const c=this.ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
    this.start=this.end-this.span;this.x=t=>12+(t-this.start)/this.span*this.plotWidth;const x=this.x;
    const bars=aggregateCandles(envelope.series,this.tf,this.end).filter(b=>b.t>=this.start-8*day);
    this.displayBars=bars;
    const rows=averages.filter(r=>r.time>=this.start-day&&r.time<=this.end);const latest=rows.at(-1);
    if(!bars.length||!latest){this.labels.replaceChildren();return;}
    const visible=bars.filter(b=>b.t>=this.start);let values=visible.flatMap(b=>[b.l,b.h]);for(const r of rows)for(const s of activeSpecs())if(Number.isFinite(r[s.key]))values.push(r[s.key]);
    let lo=Math.min(...values),hi=Math.max(...values),range=hi-lo||1;lo-=range*.08;hi+=range*.09;const y=p=>18+(hi-p)/(hi-lo)*(height-48);
    c.font='10px -apple-system,sans-serif';c.textBaseline='middle';c.fillStyle='#566779';c.strokeStyle='#14202c';c.lineWidth=.5;
    for(let i=1;i<5;i++){const yy=18+(height-48)*i/5;c.beginPath();c.moveTo(12,yy);c.lineTo(12+this.plotWidth,yy);c.stroke();c.fillText(money(hi-(hi-lo)*i/5),16,yy-7);}
    c.save();c.beginPath();c.rect(11,5,this.plotWidth+2,height-24);c.clip();
    if($('#clouds').checked){for(let i=1;i<rows.length;i++){
      const a=rows[i-1],b=rows[i];const aa=new Map(cloudBands(a).map(v=>[v.key,v]));
      for(const v of cloudBands(b)){const prev=aa.get(v.key);if(!prev)continue;c.fillStyle=rgba(v.color,v.opacity);c.beginPath();c.moveTo(x(a.time),y(prev.lo));c.lineTo(x(b.time),y(v.lo));c.lineTo(x(b.time),y(v.hi));c.lineTo(x(a.time),y(prev.hi));c.closePath();c.fill();}
    }}
    if($('#lines').checked)for(const s of activeSpecs()){
      c.lineWidth=s.width;c.setLineDash(s.key==='s100'?[5,5]:[]);
      for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];if(!Number.isFinite(a[s.key])||!Number.isFinite(b[s.key]))continue;const close=envelope.series.find(p=>p.t===b.time)?.c;const bull=s.key==='s100'?close>=b.s100:b[s.stateKey];c.strokeStyle=rgba(bull?palette.blue:palette.pink,bull?s.blueOpacity:s.pinkOpacity);c.beginPath();c.moveTo(x(a.time),y(a[s.key]));c.lineTo(x(b.time),y(b[s.key]));c.stroke();}
    }
    c.setLineDash([]);const barDays=this.tf==='D'?1:this.tf==='3D'?4.3:7;const body=Math.min(13,Math.max(1.1,this.plotWidth*barDays*day/this.span*.65));
    for(const b of bars){const xx=x(b.t);c.strokeStyle=b.c>=b.o?'#9cb3b7':'#77647b';c.fillStyle=b.c>=b.o?'#aac4c7':'#8b6e89';c.lineWidth=1;c.beginPath();c.moveTo(xx,y(b.h));c.lineTo(xx,y(b.l));c.stroke();c.fillRect(xx-body/2,Math.min(y(b.o),y(b.c)),body,Math.max(1,Math.abs(y(b.o)-y(b.c))));}
    c.restore();c.setLineDash([]);c.strokeStyle='#273043';c.beginPath();c.moveTo(this.plotWidth+16,7);c.lineTo(this.plotWidth+16,height-25);c.stroke();
    const reference=envelope.series.filter(b=>b.t<=latest.time).at(-1).c;
    const labelRows=labelLayout(activeSpecs().filter(s=>Number.isFinite(latest[s.key])).map(s=>({...s,y:y(latest[s.key]),value:latest[s.key]})),height-25,25,18);
    this.labels.replaceChildren();
    for(const row of labelRows){const bull=reference>=row.value;const node=document.createElement('div');node.className=`end-label ${bull?'blue':'pink'}`;node.style.top=`${row.y-11.5}px`;node.dataset.anchorPrice=String(row.value);node.dataset.anchorY=String(row.anchorY);node.dataset.textY=String(row.y);node.title=`${row.label} ${row.kind}: ${money(row.value)} · ${signed(signedPercent(row.value,reference))} from last visible close. Leader attaches to exact average; text can move to avoid collisions.`;for(const [tag,cl,txt]of[['b','',row.label],['span','pct',`(${signed(signedPercent(row.value,reference))})`],['span','price',money(row.value)]]){const n=document.createElement(tag);n.className=cl;n.textContent=txt;node.append(n);}this.labels.append(node);
      c.strokeStyle=rgba(bull?palette.blue:palette.pink,65);c.lineWidth=.7;c.beginPath();c.moveTo(x(latest.time),row.anchorY);c.lineTo(this.plotWidth+17,row.anchorY);c.lineTo(width-gutter+7,row.y);c.stroke();
    }
    c.font='10px -apple-system,sans-serif';c.fillStyle='#718398';c.textBaseline='bottom';const tickCount=Math.max(2,Math.min(4,Math.floor(this.plotWidth/100)));for(let i=0;i<tickCount;i++){const fraction=i/(tickCount-1);const t=this.start+this.span*fraction;c.fillText(dateLabel(t),x(t)-fraction*62,height-5);}
    this.el.querySelector('.range').textContent=`${Math.round(this.span/day)} calendar days`;
    this.el.dataset.referenceClose=String(reference);this.el.dataset.referenceTime=String(latest.time);
    this.el.dataset.visibleRows=String(rows.length);this.el.dataset.timeframe=this.tf;
  }
}
$('#controls').onsubmit=e=>{e.preventDefault();load();};$('#layout').onchange=createPanes;for(const id of ['level100','clouds','lines'])$('#'+id).onchange=()=>panes.forEach(p=>p.draw());$('#reset').onclick=createPanes;
$('#export').onclick=()=>{if(!envelope)return;const twin={schema:'scintilla.cloud-workshop.v1',createdAt:new Date().toISOString(),symbol:loadedSymbol(),validation:'NOT_PARITY_CERTIFIED',computation:COMPUTATION_CONTRACT,provenance:envelope.provenance,raw:envelope.series,averages,specs,view:panes.map(p=>({tf:p.tf,start:p.start,end:p.end,percentageReference:'LAST_VISIBLE_NATIVE_DAILY_CLOSE',referenceTime:Number(p.el.dataset.referenceTime),referenceClose:Number(p.el.dataset.referenceClose)})),optional100:$('#level100').checked};const url=URL.createObjectURL(new Blob([JSON.stringify(twin,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`scintilla-cloud-workshop-${loadedSymbol()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
load();

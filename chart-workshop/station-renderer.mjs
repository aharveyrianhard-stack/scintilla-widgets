// Extracted/adapted from Station chart/index.html: scChartDraw + scChartScrub.
// Shared presentation semantics, not an alternative indicator calculation.
export function traceStation(ctx, points) {
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i=1;i<points.length-1;i++) {
    const a=points[i],b=points[i+1];
    ctx.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);
  }
  if(points.length>1)ctx.lineTo(points.at(-1).x,points.at(-1).y);
}
export function clampView(view, count) {
  const last=Math.max(1,count-1),span=Math.min(last,Math.max(Math.min(8,last),view.end-view.start));
  const start=Math.max(0,Math.min(last-span,view.start));
  return {start,end:start+span};
}
// Station places real observations at equal horizontal intervals: closed-market gaps
// do not consume empty screen space. Between observations this is coordinate mapping only.
export function timeIndex(bars,time) {
  if(bars.length<2)return 0;
  let lo=0,hi=bars.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(bars[mid].t<=time)lo=mid;else hi=mid;}
  return lo+(time-bars[lo].t)/(bars[hi].t-bars[lo].t);
}
export function indexTime(bars,index) {
  if(bars.length<2)return bars[0]?.t;
  const i=Math.max(0,Math.min(bars.length-2,Math.floor(index)));
  return bars[i].t+(index-i)*(bars[i+1].t-bars[i].t);
}
export function viewForTimes(bars,from,to){return clampView({start:timeIndex(bars,from),end:timeIndex(bars,to)},bars.length);}
export function wheelTransaction(prior,event,now) {
  const ctrl=!!event.ctrlKey;
  let state=(!prior||now-prior.at>180||prior.ctrl!==ctrl)?{mode:null,x:0,y:0,ctrl}:prior;
  const unit=event.deltaMode===1?16:event.deltaMode===2?event.width:1;
  let dx=(event.deltaX||0)*unit,dy=(event.deltaY||0)*unit;
  if(event.shiftKey&&!dx){dx=dy;dy=0;}
  state={...state,at:now,x:state.x+Math.abs(dx),y:state.y+Math.abs(dy)};
  if(!state.mode){if(ctrl)state.mode='zoom';else if(state.x>=2&&state.x>=state.y*.8)state.mode='pan';else if(state.y>=2)state.mode='zoom';}
  return {state,dx,dy};
}
export function wireStationGestures(canvas,{getView,getCount,getWidth,setView,hover,clearHover,reset}) {
  const controller=new AbortController(),options={signal:controller.signal},pointers=new Map();
  let gesture=null,wheel=null,safari=null;
  const latest=span=>{const last=getCount()-1;setView({start:last-span,end:last});};
  const begin=()=>{
    const p=[...pointers.values()];
    gesture=p.length>1?{type:'pinch',distance:Math.max(1,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)),view:{...getView()}}:{type:'pending',x:p[0].x,view:{...getView()}};
  };
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});begin();},options);
  canvas.addEventListener('pointermove',e=>{
    const rect=canvas.getBoundingClientRect();
    if(!pointers.has(e.pointerId)){if(e.pointerType==='mouse')hover(e.clientX-rect.left,e.clientY-rect.top);return;}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
    const p=[...pointers.values()],base=gesture.view,span=base.end-base.start;
    if(p.length>1){if(gesture.type!=='pinch')begin();const distance=Math.max(1,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y));clearHover();latest(span*gesture.distance/distance);return;}
    const dx=e.clientX-gesture.x;if(Math.abs(dx)>4)gesture.type='pan';
    if(gesture.type==='pan'){canvas.classList.add('is-panning');clearHover();const shift=-dx/Math.max(1,getWidth())*span;setView({start:base.start+shift,end:base.end+shift});}
  },options);
  const release=e=>{pointers.delete(e.pointerId);canvas.classList.remove('is-panning');if(pointers.size)begin();else gesture=null;clearHover();};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release,options);
  canvas.addEventListener('pointerleave',()=>{if(!pointers.size)clearHover();},options);
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();e.stopPropagation();clearHover();
    const result=wheelTransaction(wheel,{deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,width:getWidth()},performance.now());wheel=result.state;
    const view=getView(),span=view.end-view.start;
    if(wheel.mode==='pan'){const shift=result.dx/Math.max(1,getWidth())*span;setView({start:view.start+shift,end:view.end+shift});}
    else if(wheel.mode==='zoom')latest(span*Math.exp((result.dy||(e.ctrlKey?result.dx:0))*.0018));
  },{...options,passive:false});
  for(const phase of ['gesturestart','gesturechange','gestureend'])canvas.addEventListener(phase,e=>{
    e.preventDefault();if([...pointers.values()].some(p=>p.type==='touch'))return;
    if(phase==='gesturestart')safari={...getView()};
    else if(phase==='gestureend')safari=null;
    else{if(!safari)safari={...getView()};latest((safari.end-safari.start)/Math.max(.25,Math.min(4,e.scale||1)));}
  },{...options,passive:false});
  canvas.addEventListener('dblclick',e=>{e.preventDefault();reset();},options);
  canvas.addEventListener('keydown',e=>{
    const v=getView(),span=v.end-v.start;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const shift=span*.15*(e.key==='ArrowLeft'?-1:1);setView({start:v.start+shift,end:v.end+shift});}
    else if(e.key==='+'||e.key==='='){e.preventDefault();latest(span*.8);}
    else if(e.key==='-'){e.preventDefault();latest(span*1.25);}
    else if(e.key==='Home'){e.preventDefault();reset();}
  },options);
  return ()=>controller.abort();
}

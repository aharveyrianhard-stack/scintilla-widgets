'use strict';
// Same quote authority and previous-close fields as Station. Preview, read-only.
function createHandler(fetchImpl=globalThis.fetch){return async function(req,res){
  res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');
  const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  if(req.method!=='GET')return send(405,{error:'GET only'});
  try{
    const params=new URL(req.url,'http://preview.invalid').searchParams;
    const symbol=params.get('symbol');
    if([...params.keys()].some(k=>k!=='symbol')||params.getAll('symbol').length!==1||!symbol||!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))return send(400,{error:'Invalid symbol'});
    const response=await fetchImpl('https://scintilla-massive-chart-api.fly.dev/quotes?symbols='+encodeURIComponent(symbol),{signal:AbortSignal.timeout(25000),redirect:'error'});
    if(!response.ok)throw new Error('Quote provider HTTP '+response.status);
    const reader=response.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
    while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>100000){await reader.cancel();throw new Error('Quote response too large');}text+=decoder.decode(value,{stream:true});}
    const payload=JSON.parse(text+decoder.decode()),quote=payload.quotes?.[symbol];
    if(quote?.symbol!==symbol||quote.state!=='OK'||typeof quote.price!=='number'||!Number.isFinite(quote.price)||quote.price<=0)throw new Error('Quote identity or state unavailable');
    return send(200,{symbol,quote,change_contract:payload.change_contract,generated_utc:payload.generated_utc});
  }catch(e){return send(502,{error:e.message});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;

/* Does the widget's own colour FOLLOW THE DAY, or is it simply red? Same probe, configuration B
   (our theme, TradingView's own line colour), across several symbols at once. */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const OUT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../shots");
const cfg = (sym) => ({ symbols:[[sym+"|1D"]], chartOnly:true, autosize:true, width:"100%", height:"100%",
  colorTheme:"dark", chartType:"area", lineWidth:2, gridLineColor:"#1A1A2A", fontColor:"#868AAA",
  widgetFontColor:"#868AAA", backgroundColor:"#0F0F1A", scalePosition:"right", scaleMode:"Normal",
  fontSize:"9", noTimeScale:false, valuesTracking:"0", showVolume:false, showMA:false,
  hideDateRanges:true, hideMarketStatus:true, hideSymbolLogo:true });
const url = (sym) => "https://s.tradingview.com/embed-widget/symbol-overview/?locale=en#" + encodeURIComponent(JSON.stringify(cfg(sym)));
const browser = await playwright.chromium.launch({ headless:true });
const out = [];
for (const sym of ["USI:ADD","USI:TRIN","OANDA:SPX500USD","NASDAQ:AAPL"]) {
  const ctx = await browser.newContext({ viewport:{ width:560, height:320 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url(sym), { waitUntil:"load", timeout:45000 });
    await page.waitForTimeout(9000);
    await page.screenshot({ path: path.join(OUT, `tv-direction-${sym.replace(/[^A-Z0-9]/gi,"-")}.png`) });
    const t = await page.evaluate(() => { const o={green:0,red:0,topGreen:null,topRed:null};
      for (const c of document.querySelectorAll("canvas")) { if(!c.width||!c.height) continue;
        const g=c.getContext("2d"); if(!g) continue; const d=g.getImageData(0,0,c.width,c.height).data;
        const seen=new Map();
        for (let i=0;i<d.length;i+=4){ const r=d[i],gr=d[i+1],b=d[i+2],a=d[i+3]; if(a<200) continue;
          const k=`${r},${gr},${b}`;
          if(gr-r>40&&gr-b>25){o.green++;seen.set("g:"+k,(seen.get("g:"+k)||0)+1);}
          else if(r-gr>40&&r-b>25){o.red++;seen.set("r:"+k,(seen.get("r:"+k)||0)+1);} }
        for(const [k,n] of [...seen.entries()].sort((a,b)=>b[1]-a[1])){
          if(k.startsWith("g:")&&!o.topGreen)o.topGreen={rgb:k.slice(2),px:n};
          if(k.startsWith("r:")&&!o.topRed)o.topRed={rgb:k.slice(2),px:n}; } }
      return o; });
    out.push({ sym, ...t });
  } catch (e) { out.push({ sym, error:String(e.message).slice(0,100) }); }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, "tv-colour-direction.json"), JSON.stringify({ at:new Date().toISOString(), out }, null, 1));
for (const r of out) console.log(JSON.stringify(r));

/** Pure experimental chart math. No database writes, price substitution, or resampling. */
// Custom-workshop-only neon trial. Keep these hue tokens separate from approved opacity.
// Pine and Station's shared/global palette are intentionally unchanged.
export const palette = Object.freeze({ blue: '#3455FF', pink: '#FF00A8' });

export const COMPUTATION_CONTRACT = Object.freeze({
  source: 'Native daily provider OHLC close; input timestamps preserved in milliseconds',
  emaSeed: 'First supplied daily close',
  emaBootstrap: 'PROVISIONAL_FIRST_CLOSE_SEED',
  validation: 'EXPERIMENTAL_NOT_DATABASE_OR_TRADINGVIEW_VALIDATED',
  smaWarmup: 'Null until the complete requested number of daily closes is available',
  colorFinality: 'Pair state uses supplied bars; the caller must verify completed-daily finality',
  noInterpolation: true,
});

export const specs = Object.freeze([
  { key: 'e8', label: '8D', kind: 'EMA', period: 8, width: .6, style: 'dashed', blueOpacity: 20, pinkOpacity: 8, stateKey: 'price' },
  { key: 'e13', label: '13D', kind: 'EMA', period: 13, width: 1, style: 'solid', blueOpacity: 26, pinkOpacity: 10, stateKey: 'f' },
  { key: 'e21', label: '21D', kind: 'EMA', period: 21, width: 2, style: 'solid', blueOpacity: 32, pinkOpacity: 13, stateKey: 'f' },
  { key: 's50', label: '50D', kind: 'SMA', period: 50, width: 3, style: 'solid', blueOpacity: 38, pinkOpacity: 16, stateKey: 'm' },
  { key: 's100', label: '100D', kind: 'SMA', period: 100, width: 3, style: 'dashed', blueOpacity: 41, pinkOpacity: 18.5, stateKey: 'price', disabledByDefault: true },
  { key: 's200', label: '200D', kind: 'SMA', period: 200, width: 4, style: 'solid', blueOpacity: 44, pinkOpacity: 21, stateKey: 'o' },
].map(Object.freeze));

export const cloudSpecs = Object.freeze({
  fast: Object.freeze({ blueOpacity: 44, pinkOpacity: 22 }),
  middle: Object.freeze({ blueOpacity: 36, pinkOpacity: 17 }),
  slow: Object.freeze({ blueOpacity: 26, pinkOpacity: 10 }),
});

function isFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }

function normalizeSeries(series) {
  if (!Array.isArray(series)) throw new TypeError('Candle series must be an array');
  let previous = -Infinity;
  return series.map((bar, index) => {
    if (!bar || typeof bar !== 'object' || Array.isArray(bar)) throw new TypeError(`Invalid candle at ${index}`);
    if (!Number.isSafeInteger(bar.t) || bar.t < 100_000_000_000 || bar.t > 8_640_000_000_000_000)
      throw new TypeError(`Candle ${index} requires an epoch-millisecond timestamp`);
    if (bar.t <= previous) throw new RangeError(`Candle ${index} is duplicate or not chronological`);
    for (const field of ['o', 'h', 'l', 'c'])
      if (!isFiniteNumber(bar[field]) || bar[field] <= 0) throw new TypeError(`Invalid ${field} at candle ${index}`);
    if (!isFiniteNumber(bar.v) || bar.v < 0) throw new TypeError(`Invalid volume at candle ${index}`);
    if (bar.l > bar.h || bar.o < bar.l || bar.o > bar.h || bar.c < bar.l || bar.c > bar.h)
      throw new RangeError(`Inconsistent OHLC bounds at candle ${index}`);
    previous = bar.t;
    return { ...bar };
  });
}

/** Preserve all provenance fields, including raw endpoint metadata and the local fetch receipt. */
export function normalizeEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Expected candle envelope');
  if (payload.error || payload.absence || (payload.state && payload.state !== 'OK'))
    throw new Error(`Provider data unavailable: ${String(payload.error || payload.absence || payload.state)}`);
  const series = normalizeSeries(payload.series);
  if (!series.length) throw new Error('Provider returned no candles; no synthetic replacement is allowed');
  const { series: _series, provenance: _prior, ...metadata } = payload;
  return { ...payload, series, provenance: { ...metadata } };
}

/** No timestamps are bucketed, filled, or moved. SMA windows count supplied native daily bars. */
export function computeAverages(series) {
  const bars = normalizeSeries(series);
  let e8 = null, e13 = null, e21 = null;
  const sums = { 50: 0, 100: 0, 200: 0 };
  return bars.map((bar, i) => {
    e8 = e8 === null ? bar.c : (2 / 9) * bar.c + (1 - 2 / 9) * e8;
    e13 = e13 === null ? bar.c : (2 / 14) * bar.c + (1 - 2 / 14) * e13;
    e21 = e21 === null ? bar.c : (2 / 22) * bar.c + (1 - 2 / 22) * e21;
    const ma = {};
    for (const n of [50, 100, 200]) {
      sums[n] += bar.c;
      if (i >= n) sums[n] -= bars[i - n].c;
      ma[`s${n}`] = i + 1 >= n ? sums[n] / n : null;
    }
    return { time: bar.t, e8, e13, e21, ...ma, f: e13 >= e21,
      m: ma.s50 === null ? null : e21 >= ma.s50,
      o: ma.s50 === null || ma.s200 === null ? null : ma.s50 >= ma.s200 };
  });
}

/** Exact four-boundary equivalent of the approved Pine subtractRange helper. */
export function subtractRange(lo, hi, cutLo, cutHi, cut = true) {
  if (!isFiniteNumber(lo) || !isFiniteNumber(hi)) return [null, null, null, null];
  if (lo > hi) throw new RangeError('Range lower boundary exceeds upper boundary');
  const overlaps = cut && isFiniteNumber(cutLo) && isFiniteNumber(cutHi) && cutHi > lo && cutLo < hi;
  const aHi = overlaps ? Math.max(lo, Math.min(hi, cutLo)) : hi;
  const bLo = overlaps ? Math.min(hi, Math.max(lo, cutHi)) : hi;
  return [lo, aHi, bLo, hi];
}

/** Bands in painter order. Rendering may retain zero-height endpoints for transition triangles. */
export function cloudBands(row, includeZero = false) {
  const range = (a, b) => isFiniteNumber(a) && isFiniteNumber(b) ? [Math.min(a, b), Math.max(a, b)] : [null, null];
  const [fLo, fHi] = range(row.e13, row.e21);
  const [mLo, mHi] = range(row.e21, row.s50);
  const [sLo, sHi] = range(row.s50, row.s200);
  const [mALo, mAHi, mBLo, mBHi] = subtractRange(mLo, mHi, fLo, fHi);
  const [sALo, sAHi, sBLo, sBHi] = subtractRange(sLo, sHi, mLo, mHi);
  const [sAALo, sAAHi, sABLo, sABHi] = subtractRange(sALo, sAHi, fLo, fHi);
  const [sBALo, sBAHi, sBBLo, sBBHi] = subtractRange(sBLo, sBHi, fLo, fHi);
  const bands = [];
  function add(key, layer, lo, hi, bullish) {
    if (!isFiniteNumber(lo) || !isFiniteNumber(hi) || hi < lo || (!includeZero && hi === lo) || typeof bullish !== 'boolean') return;
    const opacity = bullish ? cloudSpecs[layer].blueOpacity : cloudSpecs[layer].pinkOpacity;
    bands.push({ key, layer, lo, hi, bullish, color: bullish ? palette.blue : palette.pink, opacity });
  }
  add('slow-AA', 'slow', sAALo, sAAHi, row.o);
  add('slow-AB', 'slow', sABLo, sABHi, row.o);
  add('slow-BA', 'slow', sBALo, sBAHi, row.o);
  add('slow-BB', 'slow', sBBLo, sBBHi, row.o);
  add('middle-A', 'middle', mALo, mAHi, row.m);
  add('middle-B', 'middle', mBLo, mBHi, row.m);
  add('fast', 'fast', fLo, fHi, row.f);
  return bands;
}

/** Join real adjacent anchors, including bands emerging from or shrinking to zero height. */
export function cloudSegments(previousRow, currentRow) {
  const previous = new Map(cloudBands(previousRow, true).map(band => [band.key, band]));
  return cloudBands(currentRow, true).flatMap(band => {
    const from = previous.get(band.key);
    if (!from || (from.hi === from.lo && band.hi === band.lo)) return [];
    return [{ ...band, previousLo: from.lo, previousHi: from.hi }];
  });
}

/** Display geometry only. Split straight daily-anchor segments at every crossing,
 * then tile each vertical interval once, fastest cloud first. Endpoint clipping
 * alone leaves holes when the ordering of multiple MAs changes between anchors.
 * Intersections here are pixels/polygons, not new indicator observations. */
export function cloudPolygons(a,b) {
  const keys=['e13','e21','s50','s200'].filter(k=>isFiniteNumber(a[k])&&isFiniteNumber(b[k]));
  if(keys.length<2)return [];
  const at=(k,t)=>a[k]+(b[k]-a[k])*t,cuts=[0,1];
  for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
    const d0=a[keys[i]]-a[keys[j]],d1=b[keys[i]]-b[keys[j]];
    if(d0*d1<0)cuts.push(d0/(d0-d1));
  }
  cuts.sort((x,y)=>x-y);
  const out=[],families=[['fast','e13','e21'],['middle','e21','s50'],['slow','s50','s200']].filter(([,x,y])=>keys.includes(x)&&keys.includes(y));
  for(let i=1;i<cuts.length;i++){
    const t0=cuts[i-1],t1=cuts[i];if(t1-t0<1e-12)continue;
    const middle=(t0+t1)/2,sorted=[...keys].sort((k,l)=>at(k,middle)-at(l,middle));
    for(let j=1;j<sorted.length;j++){
      const lo=sorted[j-1],hi=sorted[j],p=(at(lo,middle)+at(hi,middle))/2;
      if(at(hi,middle)-at(lo,middle)<1e-12)continue;
      const family=families.find(([,x,y])=>p>=Math.min(at(x,middle),at(y,middle))&&p<=Math.max(at(x,middle),at(y,middle)));
      if(!family)continue;
      const [layer,x,y]=family,bullish=at(x,middle)>=at(y,middle);
      out.push({layer,bullish,color:bullish?palette.blue:palette.pink,opacity:bullish?cloudSpecs[layer].blueOpacity:cloudSpecs[layer].pinkOpacity,
        t0,t1,previousLo:at(lo,t0),previousHi:at(hi,t0),lo:at(lo,t1),hi:at(hi,t1)});
    }
  }
  return out;
}

import json,sys
d=json.load(sys.stdin); print(d['path'], d['w'], d['errs'])
for h in d['hosts']:
    c=h['chip'] or {}
    print(' ', h['t'], 'area',h['area'], 'badge',h['badgeFont'], 'plotR', h['plot'] and round(h['plot']['padL']+h['plot']['iw']), 'chip', c.get('vis'), c.get('why'), c.get('size'), 'box',c.get('box'), 'bar',c.get('bar'), c.get('vFont'), c.get('text'), 'capH',c.get('capH'),'digitH',c.get('digitH'))
for x in d.get('scrub',[]): print('  SCRUB', x)

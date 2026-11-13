/* Ember Reach's surface ports and landing: the draft model (wip/emberreach-surface/surface.js), in node.
   The plan: docs/plan-ember-reach-landing.md.
     node tests/emberreach_surface_t.js */
const path = require('path');
const S = require(path.join(__dirname, '..', 'wip/emberreach-surface/surface.js'));
const W = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const G = W('galaxy.js'), Sh = W('ships.js'), F = W('factions.js'), T = W('travel.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d) : '')) } };
try {
	const st = G.sampleGalaxy(2500, 5).filter(s => s.kind == 'star'), worlds = st.flatMap(s => G.system(s).planets.flatMap(p => [p, ...(p.moons || [])]));
	const L = worlds.filter(p => S.landable(p).ok);
	ok('1. landable worlds: airless, solid, 30-700 K, up to 2.5 g; about two in five worlds, most of them moons', L.every(p => !p.atmo && !p.gas && p.Ts <= 700 && p.Ts >= 30 && p.g <= 2.5) && L.length / worlds.length > 0.3 && L.length / worlds.length < 0.55 && L.filter(p => p.moon).length > L.length / 2, (L.length / worlds.length).toFixed(2));
	ok('2. never a world with air, however thin, nor a gas giant', worlds.filter(p => p.atmo || p.gas || p.bars > 0).every(p => !S.landable(p).ok));
	const hull = n => Sh.ships().find(s => s.name == n), moon = {g: 0.16, Ts: 250, atmo: false, gas: false, bars: 0}, heavy = {g: 1.2, Ts: 250, atmo: false, gas: false, bars: 0};
	ok('3. a ship lands where its vertical thrusters hold it with half again to spare: a Dodo anywhere landable, a Deinotherium (L hauler) on a moon but not a 1.2 g world', S.canLand(hull('Dodo'), heavy).ok && S.canLand(hull('Deinotherium'), moon).ok && !S.canLand(hull('Deinotherium'), heavy).ok);
	ok('4. XL and capital ships never land (no pad takes them)', Sh.ships().filter(s => s.size == 'XL' || s.size == 'Capital').every(s => !S.canLand(s, moon).ok && S.maxG(s) == 0));
	ok('5. touchdown: within the limits a landing, a little past them a hard one (damage), three times past a crash', S.touchdown('S', 3, 1, 5).ok && !S.touchdown('S', 3, 1, 5).damage && S.touchdown('M', 5, 1, 2).hard && S.touchdown('M', 5, 1, 2).damage > 0 && S.touchdown('L', 7, 0, 0).crash);
	let bad = [], pads = true;
	for (const k of Object.keys(S.KIND)) for (let i = 1; i <= 40; i++) { const Lo = S.layout(k, i * 7919 + k.length); bad.push(...S.check(Lo)); if (Lo.pads.length != Object.values(S.KIND[k].pads).reduce((a, b) => a + b, 0)) pads = false }
	ok('6. every layout (five kinds, forty seeds each) has all its pads, none overlapping, all on the site', pads && !bad.some(b => /overlap|off/.test(b)), bad.slice(0, 3));
	ok('7. nothing stands in a pad\'s approach corridor (35° from the vertical)', !bad.length, bad.slice(0, 3));
	ok('8. a pad is wide enough for the longest ship of its size, with room around it', ['S', 'M', 'L'].every(z => 2 * S.PAD[z].r >= 1.5 * Math.max(...Sh.ships().filter(s => s.size == z).map(s => s.length))));
	const a = S.layout('starport', 99), b = S.layout('starport', 99);
	ok('9. a layout is the same every time from its seed; a starport\'s small pads are in hangars', JSON.stringify(a) == JSON.stringify(b) && a.pads.filter(p => p.size == 'S').every(p => p.hangar));
	const m = S.meshes(a), lo = S.meshes(a, 'lo');
	ok('10. its model: meshes from the station parts, a starport under 6,000 triangles (fewer at low detail)', m.count() > 1000 && m.count() < 6000 && lo.count() < m.count() * 0.7 && m.p.every(Number.isFinite), [m.count(), lo.count()]);
	const caps = F.majors().slice(0, 12).map(x => ({s: x.star, port: T.portFor(x.star, 200)})), sp = caps.map(c => S.ports(c.s, c.port && c.port.cls));
	ok('11. a capital\'s system gets a surface starport (where it has landable ground) and more ports besides, on landable worlds under 500 K', sp.filter(l => l.length).every(l => l[0].kind == 'starport') && sp.filter(l => l.length >= 2).length >= 6 && sp.flat().every(p => p.Ts <= 500 && p.g <= 2.5), sp.map(l => l.map(p => p.kind)));
	ok('12. wild systems get none; the same ports every time', S.ports(st[0], null).length == 0 && JSON.stringify(S.ports(caps[0].s, 'halo')) == JSON.stringify(S.ports(caps[0].s, 'halo')));
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

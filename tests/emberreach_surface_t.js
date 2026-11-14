/* Ember Reach's surface ports and landing: the model (apps/rudolf-emberreach/www/surface.js), in node.
   The plan: docs/plan-ember-reach-landing.md.
     node tests/emberreach_surface_t.js */
const path = require('path');
const S = require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www/surface.js'));
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
	ok('3. a ship lands where its lift holds it with half again to spare: a Dodo anywhere landable, a Deinotherium (L hauler) on a moon but not a 1.2 g world', S.canLand(hull('Dodo'), heavy).ok && S.canLand(hull('Deinotherium'), moon).ok && !S.canLand(hull('Deinotherium'), heavy).ok);
	const all = [...Sh.ships(), ...Sh.precursors()];
	ok('4. every ship a pilot can fly can land, on any landable world up to 1 g at least (landing jets lift 1.5 g); XL ships on XL pads, capital ships at heavy fields', all.every(s => S.canLand(s, moon).ok && S.maxG(s) >= 1 - 1e-9) && S.canLand(hull('Kraken'), moon).pad == 'C' && S.canLand(hull('Brontosaur'), moon).pad == 'XL' && S.canLand(hull('Dodo'), moon).pad == 'S');
	ok('5. touchdown: within the limits a landing, a little past them a hard one (damage), three times past a crash; the bigger the ship, the gentler', S.touchdown('S', 3, 1, 5).ok && !S.touchdown('S', 3, 1, 5).damage && S.touchdown('M', 5, 1, 2).hard && S.touchdown('M', 5, 1, 2).damage > 0 && S.touchdown('L', 7, 0, 0).crash && S.touchdown('Capital', 1.5, 0, 0).hard && S.touchdown('XL', 1.4, 0, 0).ok);
	let bad = [], pads = true;
	for (const k of Object.keys(S.KIND)) for (let i = 1; i <= 40; i++) { const Lo = S.layout(k, i * 7919 + k.length); bad.push(...S.check(Lo)); if (Lo.pads.length != Object.values(S.KIND[k].pads).reduce((a, b) => a + b, 0)) pads = false }
	ok('6. every layout (six kinds, forty seeds each) has all its pads, none overlapping, all on the site', pads && !bad.some(b => /overlap|off/.test(b)), bad.slice(0, 3));
	ok('7. nothing stands in a pad\'s approach corridor (35° from the vertical)', !bad.length, bad.slice(0, 3));
	ok('8. a pad is wide enough for the longest ship of its size, with room around it (capital berths too)', ['S', 'M', 'L', 'XL', 'Capital'].every(z => 2 * S.PAD[S.padFor(z)].r >= 1.5 * Math.max(...all.filter(s => s.size == z).map(s => s.length))));
	const a = S.layout('starport', 99), b = S.layout('starport', 99);
	ok('9. a layout is the same every time from its seed; a starport\'s small pads are in hangars', JSON.stringify(a) == JSON.stringify(b) && a.pads.filter(p => p.size == 'S').every(p => p.hangar));
	const m = S.meshes(a), lo = S.meshes(a, 'lo');
	ok('10. its model: meshes from the station parts, a starport under 6,000 triangles (fewer at low detail)', m.count() > 1000 && m.count() < 6000 && lo.count() < m.count() * 0.7 && m.p.every(Number.isFinite), [m.count(), lo.count()]);
	const caps = F.majors().slice(0, 12).map(x => ({s: x.star, port: T.portFor(x.star, 200)})), sp = caps.map(c => S.ports(c.s, c.port && c.port.cls));
	ok('11. a capital\'s system gets a surface starport with its heavy landing field (where it has landable ground) and more ports besides, on landable worlds under 500 K', sp.filter(l => l.length).every(l => l[0].kind == 'starport' && l[1].kind == 'field' && l[1].world == l[0].world) && sp.filter(l => l.length >= 3).length >= 6 && sp.flat().every(p => p.Ts <= 500 && p.g <= 2.5), sp.map(l => l.map(p => p.kind)));
	const wild = st.filter(x => G.system(x).planets.some(p => [p, ...(p.moons || [])].some(q => S.landable(q).ok && q.Ts <= 500))), lone = wild.filter(x => S.ports(x, null).length);
	ok('12. with no port in space, a lone outpost or mining camp in about one such system in twenty-five; the same every time', lone.length / wild.length > 0.02 && lone.length / wild.length < 0.07 && lone.every(x => { const l = S.ports(x, null); return l.length == 1 && l[0].lone && ['outpost', 'camp'].includes(l[0].kind) }) && JSON.stringify(S.ports(caps[0].s, 'halo')) == JSON.stringify(S.ports(caps[0].s, 'halo')), (lone.length / wild.length).toFixed(3));
	ok('13. none in the Rift or at the Maw', wild.slice(0, 300).map(G.riftOf).every(x => !S.ports(x, null).length && !S.ports(x, 'halo').length) && !S.ports(G.HEART, 'halo').length);
	/* L2.2: in the game */
	const Sc = W('scene.js'), Te = W('terrain.js'), X = W('explore.js'), Sv = W('save.js'), Ld = W('landing.js');
	const capsL = F.majors().map(m => ({m, list: T.portsAt(m.star, 200)}));
	ok('14. L2.2: the ports at a capital list its space port, then its surface ports (ids like surface:<world>:<kind>), held by the capital\'s power; a surface starport brings its heavy landing field', capsL.every(({m, list}) => list[0].id == 'orbital' && list.slice(1).every(q => q.surface && T.PORT_ID.test(q.id) && q.owner == list[0].owner && !q.lone && S.KIND[q.kind]))
		&& capsL.every(({list}) => list.filter(q => q.kind == 'starport').length == list.filter(q => q.kind == 'field').length) && capsL.filter(({list}) => list.some(q => q.kind == 'starport')).length >= 10, capsL.map(({list}) => list.map(q => q.kind).join('+')));
	const allSL = capsL.flatMap(({m, list}) => list.filter(q => q.surface).map(q => ({q, w: G.system(m.star).planets.flatMap(p => [p, ...(p.moons || [])]).find(p => p.name == q.world)})));
	ok('15. every site is small beside its world at the 1/12 scale (its radius at most 3% of the world\'s), on ground you can land on', allSL.length > 20 && allSL.every(({q, w}) => w && S.KIND[q.kind].radius <= 0.03 * w.R * 6.371e6 / 12 && Ld.landable(w).ok && S.fits(q.kind, w)));
	/* the site levelled into the ground */
	const cap0 = capsL.find(({list}) => list.some(q => q.kind == 'starport')), sc0 = Sc.build(cap0.m.star, {day: 200, port: cap0.list[0].cls, portWorld: cap0.list[0].world}), sp0 = cap0.list.find(q => q.kind == 'starport'), b0 = sc0.bodies.find(b => b.name == sp0.world);
	const c0 = S.siteDir(sp0), tang = (() => { const a = Math.abs(c0[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], t = [c0[1] * a[2] - c0[2] * a[1], c0[2] * a[0] - c0[0] * a[2], c0[0] * a[1] - c0[1] * a[0]], l = Math.hypot(...t); return t.map(v => v / l) })();
	const at = m => { const k = m / b0.radius, d = c0.map((v, i) => v * Math.cos(k) + tang[i] * Math.sin(k)); return Te.height(b0, d) };
	const before = [0, 500, 1000, 1800].map(at), lev = S.level(sc0.bodies, cap0.list), again = S.level(sc0.bodies, cap0.list), after = [0, 500, 1000, 1800].map(at), far = at(4000);
	ok('16. a surface starport\'s site is levelled into the ground: flat across its 1.9 km (it wasn\'t), ramped to the ground beyond; levelled once', lev >= 1 && again == 0 && Math.max(...after) - Math.min(...after) < 0.5 && Math.max(...before) - Math.min(...before) > 5 && Math.abs(far - after[0]) > 0.01,
		{before: before.map(Math.round), after: after.map(x => +x.toFixed(2)), far: Math.round(far)});
	/* lone ports: their holder; found by ground scan or charts, and kept in the save */
	const loneStar = wild.find(x => S.ports(x, null).length && !T.portFor(x, 200)), lp = loneStar && T.portsAt(loneStar, 200).find(q => q.lone), own = loneStar && T.ownerOf(loneStar, 200);
	const Pl = {explore: {sys: {}, pl: {}, sold: {}, names: {}}};
	ok('17. a lone port is the power\'s whose space it\'s in, or independent in unclaimed space; once found (by a ground scan or the charts) the record keeps it, and the save too', !!lp && (own.owner && !own.contested ? lp.owner == own.owner : lp.independent && lp.owner === null)
		&& !X.found(Pl, loneStar.id, lp.id) && X.find(Pl, loneStar.id, lp.id, 210) && !X.find(Pl, loneStar.id, lp.id, 211) && X.found(Pl, loneStar.id, lp.id) && Pl.explore.found[loneStar.id + '|' + lp.id] == 210);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

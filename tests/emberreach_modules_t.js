/* Ember Reach's ship modules (wip/emberreach/modules.js), with flight (flight.js), in node.
     node tests/emberreach_modules_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const M = require(path.join(DIR, 'modules.js')), Fl = require(path.join(DIR, 'flight.js')), S = require(path.join(DIR, 'ships.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const DT = 1 / 60;
const fly = (s, input, t) => { let r; for (let k = Math.round(t / DT); k > 0; k--) r = Fl.step(s, input, DT); return r };
try {
	const L = S.ships(), kestrel = L.find(s => s.id == 'kestrel'), wren = L.find(s => s.id == 'wren');
	const fits = L.map(M.fit);
	ok('1. every one of the 40 stock ships carries a power plant, engines, hyperspace drive, canopy, RCS and ACS, each with its own health',
		fits.every(f => ['power', 'engines', 'jump', 'canopy', 'rcs', 'acs'].every(id => { const m = M.get(f, id); return m && m.hp == m.max && m.max >= 10 })));
	ok('2. weapons only on armed ships, a cargo hatch only where there is a hold', L.every((s, i) => !!M.get(fits[i], 'weapons') == s.hard.some(n => n > 0) && !!M.get(fits[i], 'hatch') == s.cargo > 0));
	ok('3. bigger hulls have bigger health pools', M.get(M.fit(L.find(s => s.id == 'monolith')), 'engines').max > 100 * M.get(M.fit(wren), 'engines').max);

	/* breaking a module raises an alert, once */
	let f = M.fit(kestrel);
	const half = M.damage(f, 'canopy', M.get(f, 'canopy').max / 2), a = M.damage(f, 'canopy', 1e6), again = M.damage(f, 'canopy', 5);
	ok('4. a module breaks at zero health and says so once: "Canopy inoperable"', half === null && a && a.text == 'Canopy inoperable' && again === null && M.get(f, 'canopy').hp == 0);
	ok('5. an ordinary module\'s alert is an orange triangle', a.icon == 'triangle' && a.level == 'warning' && a.color == M.COLORS.warning && a.flash == 'canopy');
	const crit = ['engines', 'jump', 'power'].map(id => M.damage(M.fit(kestrel), id, 1e6));
	ok('6. engines, hyperspace drive and power plant raise red alerts', crit.every(x => x && x.level == 'critical' && x.color == M.COLORS.critical) && crit.map(x => x.text).join(', ') == 'Engines inoperable, Hyperspace drive inoperable, Power plant inoperable');
	M.damage(f, 'jump', 1e6);
	ok('7. the HUD lists standing alerts critical first', M.alerts(f).map(x => x.module).join() == 'jump,canopy');

	/* g-forces: none while the canopy holds */
	f = M.fit(kestrel);
	let s = Fl.create(kestrel); M.apply(f, s);
	let r = fly(s, {throttle: 1}, 0.5);
	const intact = M.gForce(f, r);
	M.damage(f, 'canopy', 1e6);
	const broken = M.gForce(f, r);
	ok('8. hard acceleration: the pilot feels no g-force while the canopy holds, and all of it once it breaks', intact.g > 5 && intact.felt == 0 && Math.abs(broken.felt - intact.g) < 1e-12, intact.g.toFixed(1) + ' g');
	M.repair(f, 'canopy');
	ok('9. repairing the canopy brings the protection back', M.gForce(f, r).felt == 0 && M.alerts(f).length == 0);

	/* broken thrusters change how the ship flies */
	f = M.fit(kestrel); s = Fl.create(kestrel); M.damage(f, 'engines', 1e6); M.apply(f, s);
	fly(s, {throttle: 1}, 5);
	ok('10. engines out: the main drive gives nothing (only the RCS can push, at most strafe speed)', Fl.len(s.v) < 1e-9);
	f = M.fit(kestrel); s = Fl.create(kestrel, {w: [0.5, 0, 0]}); M.damage(f, 'acs', 1e6); M.apply(f, s);
	fly(s, {}, 3);
	ok('11. ACS out: a turn can\'t be stopped, even with flight assist', Math.abs(s.w[0] - 0.5) < 1e-12);
	f = M.fit(kestrel); s = Fl.create(kestrel); fly(s, {throttle: 1}, 15); M.damage(f, 'rcs', 1e6); M.apply(f, s);
	let m = 0; for (let k = 0; k < 120; k++) { Fl.step(s, {throttle: 1, pitch: 1}, DT); m = Math.max(m, Fl.slip(s)) }
	ok('12. RCS out: flight assist can\'t hold the path, so a turn at speed slides', m > 20, m.toFixed(0) + '° slip');
	f = M.fit(kestrel); s = Fl.create(kestrel, {v: [0, 0, 100], w: [0.2, 0, 0]}); M.damage(f, 'power', 1e6);
	const st = M.apply(f, s), v0 = s.v.slice();
	fly(s, {throttle: 0, pitch: -1}, 3);
	ok('13. power plant out: no thrust, no turning, no jump, no shields; the ship drifts', !st.jump && !st.shields && !st.sensors && Math.abs(s.v[2] - v0[2]) < 1e-9 && Math.abs(s.w[0] - 0.2) < 1e-12);
	f = M.fit(kestrel); M.damage(f, 'jump', 1e6);
	ok('14. hyperspace drive out: the ship flies but can\'t jump', !M.status(f).jump && M.status(f).output.main == 1);

	/* hits land on modules by their size, repeatably */
	f = M.fit(kestrel);
	const counts = {};
	for (let k = 0; k < 1000; k++) { const h = M.hit(M.fit(kestrel), 1, (k + 0.5) / 1000); counts[h.module] = (counts[h.module] || 0) + 1 }
	const tot = f.modules.reduce((t, x) => t + x.max, 0);
	ok('15. a hit lands on a module in proportion to its size', f.modules.every(x => Math.abs(counts[x.id] / 1000 - x.max / tot) < 0.01));
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

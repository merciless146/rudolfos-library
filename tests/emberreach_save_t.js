/* Ember Reach's save (wip/emberreach/save.js), with the ship's flight state and modules, in node.
     node tests/emberreach_save_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const Sv = require(path.join(DIR, 'save.js')), Fl = require(path.join(DIR, 'flight.js')), M = require(path.join(DIR, 'modules.js')), S = require(path.join(DIR, 'ships.js')), Sc = require(path.join(DIR, 'scene.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
try {
	const ships = S.ships(), wren = ships.find(s => s.id == 'wren'), known = {powers: 46, ports: Object.keys(Sc.STATION), ships: ships.map(s => s.id)};
	const s = Fl.create(wren, {p: [1.2e11, -3.4e10, 2.5e6], v: [12.5, -3, 180], q: Sc.lookRotation([0.3, 0.4, 0.86], [0, 0, 1]), w: [0.1, 0, -0.2], fa: false});
	const fit = M.fit(wren); M.damage(fit, 'canopy', 1e6); M.damage(fit, 'engines', 4.5);
	const g = {power: 3, port: 'trefoil', ship: 'wren', day: 200, t: 1234.5678, docked: false, pad: null, s, throttle: 0.42, fit, settings: {quality: 'low', sound: false}};
	const json = JSON.stringify(Sv.pack(g)), back = Sv.unpack(JSON.parse(json), known);
	ok('1. a save survives JSON: place, motion, heading, spin, flight assist, throttle, settings', back && back.p.every((x, i) => Math.abs(x - s.p[i]) < 1e-3) && back.v.every((x, i) => Math.abs(x - s.v[i]) < 1e-9)
		&& back.q.every((x, i) => Math.abs(x - s.q[i]) < 1e-12) && back.fa === false && back.throttle == 0.42 && back.settings.quality == 'low' && back.settings.sound === false && back.power == 3 && back.port == 'trefoil');
	const fit2 = Sv.restoreModules(M.fit(wren), back.modules);
	ok('2. module damage comes back: the broken canopy, the dented engines', M.get(fit2, 'canopy').hp == 0 && Math.abs(M.get(fit2, 'engines').hp - (M.get(fit2, 'engines').max - 4.5)) < 1e-9 && M.alerts(fit2).length == 1);
	ok('3. it stays small (well under gamekit\'s limit)', json.length < 1500, json.length + ' bytes');
	ok('4. a docked save keeps its pad', Sv.unpack(JSON.parse(JSON.stringify(Sv.pack(Object.assign({}, g, {docked: true, pad: 7})))), known).pad == 7);
	const bad = [null, 7, {}, Object.assign(JSON.parse(json), {v: 2}), Object.assign(JSON.parse(json), {ship: 'nosuch'}), Object.assign(JSON.parse(json), {port: 'castle'}),
		Object.assign(JSON.parse(json), {power: 99}), Object.assign(JSON.parse(json), {p: [1, 2]}), Object.assign(JSON.parse(json), {q: [0, 0, 0, 0]}), Object.assign(JSON.parse(json), {modules: {canopy: -3}}),
		Object.assign(JSON.parse(json), {vel: [1, 'x', 3]}), Object.assign(JSON.parse(json), {t: -5})];
	ok('5. anything damaged or from another version gives null (a new game, not a broken one)', bad.every(b => Sv.unpack(b, known) === null));
	ok('6. module health never comes back above its pool', M.get(Sv.restoreModules(M.fit(wren), {engines: 1e9}), 'engines').hp == M.get(M.fit(wren), 'engines').max);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

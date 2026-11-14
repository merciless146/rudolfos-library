/* Ember Reach's save (apps/rudolf-emberreach/www/save.js), with the ship's flight state and modules, in node.
     node tests/emberreach_save_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Tr = require(path.join(DIR, 'trade.js')), E = require(path.join(DIR, 'economy.js')), F = require(path.join(DIR, 'factions.js')), Sv = require(path.join(DIR, 'save.js')), Fl = require(path.join(DIR, 'flight.js')), M = require(path.join(DIR, 'modules.js')), S = require(path.join(DIR, 'ships.js')), Sc = require(path.join(DIR, 'scene.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
try {
	const ships = S.ships(), wren = ships.find(s => s.id == 'wren'), known = {powers: 12, ports: Object.keys(Sc.STATION), ships: ships.map(s => s.id)};
	const s = Fl.create(wren, {p: [1.2e11, -3.4e10, 2.5e6], v: [12.5, -3, 180], q: Sc.lookRotation([0.3, 0.4, 0.86], [0, 0, 1]), w: [0.1, 0, -0.2], fa: false});
	const fit = M.fit(wren); M.damage(fit, 'canopy', 1e6); M.damage(fit, 'engines', 4.5);
	const here = {id: 'abc123', x: 12.5, y: -3.25, z: 1050.125}, g = {power: 3, port: 'trefoil', ship: 'wren', day: 200, t: 1234.5678, docked: false, pad: null, s, throttle: 0.42, fit, settings: {quality: 'low', sound: false}, star: here, fuel: 0.625, lastPort: here, routeTo: null};
	const json = JSON.stringify(Sv.pack(g)), back = Sv.unpack(JSON.parse(json), known);
	ok('1. a save survives JSON: place, motion, heading, spin, flight assist, throttle, settings', back && back.p.every((x, i) => Math.abs(x - s.p[i]) < 1e-3) && back.v.every((x, i) => Math.abs(x - s.v[i]) < 1e-9)
		&& back.q.every((x, i) => Math.abs(x - s.q[i]) < 1e-12) && back.fa === false && back.throttle == 0.42 && back.settings.graphics.quality == 'low' && back.settings.audio.on === false && back.power == 3 && back.port == 'trefoil');
	const fit2 = Sv.restoreModules(M.fit(wren), back.modules);
	ok('2. module damage comes back: the broken canopy, the dented engines', M.get(fit2, 'canopy').hp == 0 && Math.abs(M.get(fit2, 'engines').hp - (M.get(fit2, 'engines').max - 4.5)) < 1e-9 && M.alerts(fit2).length == 1);
	ok('3. it stays small (well under gamekit\'s limit)', json.length < 1500, json.length + ' bytes');
	ok('4. a docked save keeps its pad', Sv.unpack(JSON.parse(JSON.stringify(Sv.pack(Object.assign({}, g, {docked: true, pad: 7})))), known).pad == 7);
	const bad = [null, 7, {}, Object.assign(JSON.parse(json), {v: 4}), Object.assign(JSON.parse(json), {ship: 'nosuch'}), Object.assign(JSON.parse(json), {port: 'castle'}),
		Object.assign(JSON.parse(json), {power: 99}), Object.assign(JSON.parse(json), {p: [1, 2]}), Object.assign(JSON.parse(json), {q: [0, 0, 0, 0]}), Object.assign(JSON.parse(json), {modules: {canopy: -3}}),
		Object.assign(JSON.parse(json), {vel: [1, 'x', 3]}), Object.assign(JSON.parse(json), {t: -5})];
	ok('5. anything damaged or from another version gives null (a new game, not a broken one)', bad.every(b => Sv.unpack(b, known) === null));
	ok('7. version 2 keeps the star, the fuel and the last port; a system with no port saves with port null', back.star.id == 'abc123' && back.star.p[2] == 1050.125 && back.fuel == 0.625 && back.lastPort.id == 'abc123' && back.routeTo === null
		&& Sv.unpack(JSON.parse(JSON.stringify(Sv.pack(Object.assign({}, g, {port: null})))), known).port === null);
	const v1 = Object.assign(JSON.parse(json), {v: 1}); delete v1.star; delete v1.fuel;
	ok('8. an M1 save (version 1, always the home system) still loads, with a full tank', (() => { const b = Sv.unpack(v1, known); return b && b.star === null && b.fuel == 1 && b.version == 1 })());
	ok('9. a version 2 save without its star is refused', Sv.unpack(Object.assign(JSON.parse(json), {star: null}), known) === null);
	/* version 3: the player */
	const pl = Tr.newPlayer(F.majors()[0].id), mk = E.market(F.majors()[0].star, 200), w = ships.find(x => x.id == pl.ship.model);
	Tr.buy(pl, w, mk, Object.keys(mk.prices)[0], 2, 200); pl.bounties = {ROA: 500};
	const g3 = Object.assign({}, g, {player: pl}), b3 = Sv.unpack(JSON.parse(JSON.stringify(Sv.pack(g3))), known);
	ok('10. version 3 keeps the player: wallet, cargo and its cost, reputation, bounties, ship', b3 && b3.player.origin == pl.origin && Math.abs(Tr.walletSU(b3.player, 200) - Tr.walletSU(pl, 200)) < 1
		&& JSON.stringify(b3.player.cargo) == JSON.stringify(pl.cargo) && Math.abs(b3.player.rep[pl.origin] - pl.rep[pl.origin]) < 0.01 && b3.player.bounties.ROA == 500 && b3.player.ship.model == pl.ship.model);
	ok('11. ...and refuses a player with negative money or fractional cargo', [{wallet: {ROA: -5}}, {cargo: {Iron: 1.5}}, {origin: 7}].every(bad => Sv.unpack(Object.assign(JSON.parse(JSON.stringify(Sv.pack(g3))), {player: Object.assign(JSON.parse(JSON.stringify(Sv.packPlayer(pl))), bad)}), known) === null));
	ok('12. a version 2 save loads without a player (one is made from its origin)', (() => { const v2 = JSON.parse(JSON.stringify(Sv.pack(g))); v2.v = 2; delete v2.player; const b = Sv.unpack(v2, known); return b && b.player === null && b.star })());
	ok('6. module health never comes back above its pool', M.get(Sv.restoreModules(M.fit(wren), {engines: 1e9}), 'engines').hp == M.get(M.fit(wren), 'engines').max);
	ok('13. the player carries the hull\'s health, the magazines and war missions in hand (M4); a save without them still loads', (() => {
		const p2 = JSON.parse(JSON.stringify(Sv.packPlayer(pl)));
		const withM = Sv.unpackPlayer(Object.assign({}, p2, {combat: {hull: 0.4, ammo: [null, 90], missiles: 3, flares: 2}, missions: [{id: 'a:1', star: {id: 's', at: [1, 2, 3]}, due: 210, text: 'x'}, {id: 7}]}));
		const without = Sv.unpackPlayer(p2);
		return withM.combat.hull == 0.4 && withM.missions.length == 1 && without.combat === null && without.missions.length == 0;
	})());
	ok('14. a long game\'s save stays under gamekit\'s 256 KB: old mining and sold charts are trimmed, firsts and names kept, and the game\'s own record untouched', (() => {
		const big = JSON.parse(JSON.stringify(pl)); big.mined = {}; for (let i = 0; i < 3000; i++) big.mined['ring:Kavethora b#' + i] = 1.23;
		big.explore = {sys: {}, pl: {}, sold: {}, names: {}};
		for (let i = 0; i < 6000; i++) { const id = (i % 90) + ',' + (i % 7) + ',' + Math.floor(i / 90) + '/1#' + i; big.explore.sys[id] = i; big.explore.sold[id] = 1; big.explore.pl[id + '|World b'] = {s: 1, f: i % 500 == 0 ? 1 : 0} }
		big.explore.names['0,0,0/1#0|World b'] = 'Hope';
		const firsts = Object.keys(big.explore.pl).filter(k => big.explore.pl[k].f).length, was = Object.keys(big.explore.sys).length;
		const out = Sv.pack(Object.assign({}, g3, {player: big})), n = JSON.stringify(out).length, X = out.player.explore;
		return n <= 256 * 1024 && n > 150 * 1024 && Object.keys(X.pl).filter(k => X.pl[k].f).length == firsts && X.names['0,0,0/1#0|World b'] == 'Hope' && Object.keys(big.explore.sys).length == was && Sv.unpack(JSON.parse(JSON.stringify(out)), known);
	})());
	/* 0.2.0: a save from the old galaxy (8 billion stars, 46 powers) keeps only its settings */
	const old = JSON.parse(JSON.stringify(Sv.pack(Object.assign({}, g, {settings: Object.assign({}, g.settings || {}, {lang: 'de'})})))); delete old.galaxy;
	const ob = Sv.unpack(old, known);
	ok('18. a save from before 0.2.0\'s galaxy starts a new game, keeping its settings', ob && ob.oldGalaxy && !ob.ship && ob.settings && ob.settings.lang == 'de' && Sv.unpack(JSON.parse(json), known).ship && JSON.parse(json).galaxy == Sv.GALAXY, ob && Object.keys(ob).join());
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

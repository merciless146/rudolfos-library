/* Ember Reach's Interstellar Marshals (encounters.js, combat.js), in node: who they want, their ships, the
   disruptor, the guards at the Maw's anchorage, and what's kept in saves.
     node tests/emberreach_marshals_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const req = f => require(path.join(DIR, f));
const G = req('galaxy.js'), F = req('factions.js'), En = req('encounters.js'), S = req('ships.js'), C = req('combat.js'), M = req('modules.js'), O = req('outfit.js'),
	E = req('economy.js'), Tr = req('trade.js'), T = req('travel.js'), Sv = req('save.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
try {
	const K = En.MARSHALS, home = F.majors()[0], code = home.currency.code, day = 200;
	ok('1. the Interstellar Marshals: a neutral force, wanting pilots over 50,000 SU of bounty or 10 police ships in 10 days', K.name == 'The Interstellar Marshals' && K.bounty == 50000 && K.police == 10 && K.window == 10);
	/* who they want */
	const pl = Tr.newPlayer(home.id), rate = E.rate(code, day);
	pl.bounties[code] = 49000 * rate;
	ok('2. under 50,000 SU of bounty: not wanted', !En.marshalsWant(pl, day));
	const other = F.majors().find(m => m.id != home.id).currency.code; pl.bounties[other] = 2000 * E.rate(other, day);
	const w = En.marshalsWant(pl, day);
	ok('3. bounties in every currency count together, in SU: 51,000 is wanted', w && Math.abs(w.bounty - 51000) < 2, w && w.bounty);
	const p2 = Tr.newPlayer(home.id);
	p2.policeKills = [day - 12, day - 11, ...Array(9).fill(day - 3)];
	ok('4. nine police ships in 10 days (and two older ones): not wanted', !En.marshalsWant(p2, day) && En.policeKills(p2, day) == 9);
	const patrol = {role: 'patrol', faction: home.id, ship: S.ships().find(s => s.who.includes('navy')), provoked: true};
	En.killed(p2, patrol, {star: home.star, day, own: {owner: home.id}});
	ok('5. a tenth (a port\'s patrol) makes you wanted; the old ones drop off the record', En.policeKills(p2, day) == 10 && En.marshalsWant(p2, day).kills == 10 && p2.policeKills.every(d => day - d < 10));
	ok('6. ...and ten days on, the record has cleared', !En.marshalsWant(p2, day + 10));
	/* their ships */
	const wing = En.marshalWing(seeded(3)), lead = wing[0].ship, pre = s => S.precursors().find(p => p.size == s.size), nav = S.ships().filter(s => s.who.includes('navy'));
	ok('7. a hunting wing: two or three ships, a large one leading, appearing 6-9 km off', wing.length >= 2 && wing.length <= 3 && lead.size == 'L' && wing.slice(1).every(n => n.ship.size == 'M') && wing.every(n => n.role == 'marshal' && n.range >= 6000 && n.range <= 9000 && n.ai == 'attack'));
	ok('8. shields and armour just below Precursor level (90% of the Precursor hull of their size), above any navy hull', wing.every(n => n.ship.hull == Math.round(pre(n.ship).hull * 0.9) && n.ship.shield == Math.round(pre(n.ship).shield * 0.9) && n.ship.hull < pre(n.ship).hull && n.ship.hull > Math.max(...nav.filter(s => s.size == n.ship.size).map(s => s.hull))));
	ok('9. they carry disruptors and a tractor beam, and fly as fitted (their own hull and shields)', wing.every(n => n.ship.guns.filter(g => g == 'disruptor').length == 2 && n.ship.tractor) && C.state(lead).load.guns.filter(g => g.kind == 'disruptor').length == 2 && C.state(lead).hullMax == lead.hull && C.state(lead).shieldMax == lead.shield);
	/* the disruptor: it cuts into the shield generator through raised shields */
	const me = C.state(O.derive(S.hull('corsair'))), gen = M.get(me.fit, 'shields');
	let hits = 0; for (; hits < 60 && gen.hp > 0; hits++) { C.damage(me, C.WEAPONS.disruptor.dmg, 'disruptor', hits * 0.5); me.shield = me.shieldMax }
	ok('10. a disruptor hit reaches the shield generator itself even with shields up: about 25 hits put it out', gen.hp == 0 && hits >= 20 && hits <= 30 && !M.works(me.fit, 'shields'), hits + ' hits');
	const reg = C.state(O.derive(S.hull('corsair'))); C.damage(reg, 9, 'heavy', 0);
	ok('11. other weapons don\'t: a heavy laser on raised shields leaves the generator whole', M.get(reg.fit, 'shields').hp == M.get(reg.fit, 'shields').max);
	/* who they fight */
	const clean = Tr.newPlayer(home.id), m0 = wing[0];
	ok('12. they hunt only the wanted: hostile to a wanted pilot, not to a clean one', En.hostile(pl, m0) && !En.hostile(clean, m0));
	ok('13. the Riftborn and the Marshals fight each other', En.enemies({role: 'riftborn', faction: 'riftborn'}, m0) && En.enemies(m0, {role: 'riftborn', faction: 'riftborn'}));
	/* where they are: guarding the Maw's anchorage in the Rift; hunting this side only (play.js) */
	const mawR = G.lookup('R:heart'), port = T.portFor(mawR, day);
	const casts = [...Array(30)].map((_, v) => En.cast(mawR, day, clean, {port, visit: v}));
	ok('14. two Marshal guards at the Maw\'s anchorage on every visit, holding the port', casts.every(c => c.filter(n => n.role == 'marshal').length == 2 && c.filter(n => n.role == 'marshal').every(n => n.where == 'port' && n.guard && n.ai == 'patrol')));
	const H = [...T.havens()].slice(0, 5).map(id => G.lookup(id)), elsewhere = H.flatMap(h => [...Array(10)].flatMap((_, v) => En.cast(h, day, pl, {port: T.portFor(h, day), visit: v})));
	ok('15. elsewhere in the Rift there are no Marshals, wanted or not: only the Riftborn', elsewhere.every(n => n.role == 'riftborn'));
	ok('16. nor in a system\'s own cast this side (they come for you after you arrive)', [...Array(20)].flatMap((_, v) => En.cast(home.star, day, pl, {port: T.portFor(home.star, day), visit: v})).every(n => n.role != 'marshal'));
	ok('17. the anchorage at the Maw is the Marshals\' to keep, and still nobody\'s to own (trade in SU)', port.maw && port.anchorage && !port.owner);
	const kill = Tr.newPlayer(home.id); kill.policeKills = Array(9).fill(day); const res = En.killed(kill, Object.assign({}, m0, {provoked: true}), {star: mawR, day, own: {}});
	ok('18. destroying a Marshal ship counts as a police ship, and says so', En.policeKills(kill, day) == 10 && res.msg.some(m => /Marshal ship destroyed/.test(m)), res.msg.join(' / '));
	/* saves */
	const pk = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(kill))));
	ok('19. the police ships you destroyed are kept in the save', pk && pk.policeKills.length == 10 && En.marshalsWant(pk, day));
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

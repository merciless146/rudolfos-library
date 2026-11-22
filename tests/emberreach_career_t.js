/* Ember Reach's pilot careers (0.5.6: career.js; docs/plan-ember-reach-pilots.md P2), in node: difficulty and
   Hardcore's rules, the rewards, premiums and damage they scale, how enemies fight by them, and the save.
     node tests/emberreach_career_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const Ca = req('career.js'), Sv = req('save.js'), F = req('factions.js'), Tr = req('trade.js'), S = req('ships.js'), O = req('outfit.js'), X = req('explore.js'), Ins = req('insurance.js'),
	C = req('combat.js'), Fl = req('flight.js'), G = req('galaxy.js'), T = req('travel.js'), R = req('reputation.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 500) : '')) } };
try {
	const home = F.majors()[1], code = home.currency.code, day = 200;
	const pilot = o => { const p = Tr.newPlayer(home.id); p.ship.fit = O.stock(S.hull(p.ship.model)); return Ca.make(p, o) };
	/* making a pilot */
	const hc = pilot({name: '  Ada   Vex ', diff: 'rookie', hardcore: true}), plain = pilot({name: '<b>', diff: 'admiral'}), def = pilot();
	ok('1. a new pilot: a clean name (or none), the difficulty chosen (Pilot if none), and Hardcore making them an Admiral whatever was picked', hc.name == 'Ada Vex' && hc.hc == 'on' && hc.diff == 'admiral' && plain.name == '' && plain.diff == 'admiral' && plain.hc == 'none' && def.diff == 'pilot' && def.hc == 'none', {hc, plain});
	/* the multipliers */
	const k = o => Ca.rewardK(pilot(o));
	ok('2. rewards: Rookie 0.75, Pilot 1, Admiral 1.25; Hardcore 1.5 on top (1.875)', k({diff: 'rookie'}) == 0.75 && k({diff: 'pilot'}) == 1 && k({diff: 'admiral'}) == 1.25 && k({hardcore: true}) == 1.875);
	ok('3. damage taken 0.7 / 1 / 1.3, premiums 0.6 / 1 / 1.5, enemies\' skill 0.75 / 1 / 1.25', ['rookie', 'pilot', 'admiral'].map(d => [Ca.takenK(pilot({diff: d})), Ca.premiumK(pilot({diff: d})), Ca.skill(pilot({diff: d}))].join()).join('|') == '0.7,0.6,0.75|1,1,1|1.3,1.5,1.25');
	/* Hardcore's states */
	const h = pilot({hardcore: true});
	const r1 = Ca.setDiff(h, 'pilot', true), off1 = Ca.hcOff(h), r2 = Ca.setDiff(h, 'rookie', false), r3 = Ca.setDiff(h, 'rookie', true), off2 = Ca.hcOff(h);
	ok('4. Hardcore holds the pilot at Admiral; turned off (asked for), the difficulty changes again, but only while docked; it can\'t be turned off twice', !r1.ok && h.diff == 'rookie' && off1.ok && h.hc == 'off' && !r2.ok && r3.ok && !off2.ok, {r1, r2, r3});
	ok('5. ...and off is for good: no rewards from it, no merchant, no wipe; nothing turns it on again (make() is the only way, and only for a new pilot)', !Ca.hcPerks(h) && Ca.rewardK(h) == 0.75 && !Ca.diesForGood(h) && !('hcOn' in Ca) && Ca.unpack({hc: 'off'}, {}).hc == 'off');
	const d = pilot({hardcore: true}), fin = Ca.hcFinish(d);
	ok('6. finishing the questline on Hardcore: done; its rewards and merchant stay, the wipe on death ends, the difficulty is free again', fin && d.hc == 'done' && Ca.hcPerks(d) && Ca.rewardK(d) == 1.875 && !Ca.diesForGood(d) && Ca.setDiff(d, 'pilot', true).ok && Ca.rewardK(d) == 1.5 && !Ca.hcFinish(pilot()));
	ok('7. losing the ship ends only a pilot with Hardcore on', Ca.diesForGood(pilot({hardcore: true})) && !Ca.diesForGood(pilot()) && !Ca.diesForGood(Object.assign(pilot({hardcore: true}), {hc: 'off'})));
	/* payouts */
	const cap = home.star, ruin = X.ruinsNear([cap.x, cap.y, cap.z], 30).find(x => !T.portFor(x.star, day));
	const sell = o => { const p = pilot(o); X.survey(p, ruin.star, ruin.planet, null, day); const before = p.wallet[code] || 0; X.sell(p, null, code, day); return (p.wallet[code] || 0) - before };
	const sr = sell({diff: 'rookie'}), sp = sell({diff: 'pilot'}), sh = sell({hardcore: true});
	ok('8. exploration data pays by the multiplier (Rookie 0.75, Hardcore 1.875 of a Pilot\'s)', sp > 0 && Math.abs(sr / sp - 0.75) < 1e-9 && Math.abs(sh / sp - 1.875) < 1e-9, {sr, sp, sh});
	const war = o => { const p = pilot(o); p.warEvents = []; const before = p.wallet[code] || 0; R.warEffort(p, {war: 'w', system: 's', issuer: home.id, against: F.majors().find(m => m.id != home.id).id, effort: 1, reward: 1000, currency: code}, day); return p.wallet[code] - before };
	ok('9. a war mission\'s reward too (Admiral 1,250 for 1,000)', war({diff: 'admiral'}) == 1250 && war({diff: 'pilot'}) == 1000, war({diff: 'admiral'}));
	const prem = o => { const p = pilot(o); return Ins.premium(p, S.hull(p.ship.model), p.ship.fit, day).amount };
	ok('10. the insurance premium by the difficulty (Rookie 0.6, Admiral 1.5 of a Pilot\'s)', Math.abs(prem({diff: 'rookie'}) / prem({diff: 'pilot'}) - 0.6) < 1e-9 && Math.abs(prem({diff: 'admiral'}) / prem({diff: 'pilot'}) - 1.5) < 1e-9);
	ok('11. trade is never multiplied (the galaxy\'s markets are the same for every pilot)', Tr.pay.toString().indexOf('reward') < 0 && !/Ca\.|career/.test(require('fs').readFileSync(path.join(__dirname, '..', 'apps/rudolf-emberreach/www/trade.js'), 'utf8')));
	/* the save */
	const sv = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(pilot({name: 'Kestrel One', hardcore: true}))))), old = Sv.packPlayer(pilot()); delete old.name; delete old.diff; delete old.hc;
	const o2 = Sv.unpackPlayer(old), bad = Sv.unpackPlayer(Object.assign(Sv.packPlayer(pilot()), {hc: 'on', diff: 'rookie', name: 'x'.repeat(40)}));
	ok('12. the save keeps the name, difficulty and Hardcore; an older pilot is a Pilot without Hardcore; Hardcore on always loads as an Admiral; a bad name is dropped', sv.name == 'Kestrel One' && sv.hc == 'on' && sv.diff == 'admiral' && o2.diff == 'pilot' && o2.hc == 'none' && bad.diff == 'admiral' && bad.name == '', {sv: [sv.name, sv.hc, sv.diff], bad: [bad.diff, bad.name]});
	const gal = Sv.newGalaxy(1), sm = Sv.summary('p4', {player: pilot({name: 'Wren', hardcore: true}), power: 1, star: {id: 'x', name: 'X'}, day: 3}, null);
	gal.world.colonies = [{id: 'c', owner: 'p4', star: {id: 's'}, stage: 'done'}, {id: 'd', owner: 'p5', star: {id: 't'}, stage: 'done'}]; Sv.orphan(gal, 'p4');
	ok('13. a slot\'s summary shows the name, difficulty and Hardcore; a gone pilot\'s colonies become independent (nobody\'s), the others\' stay theirs', sm.name == 'Wren' && sm.diff == 'admiral' && sm.hc == 'on' && gal.world.colonies[0].owner == '' && gal.world.colonies[0].orphan && gal.world.colonies[1].owner == 'p5');
	/* how enemies fight */
	const kestrel = S.ships().find(s => s.id == 'kestrel');
	const ship = () => { const a = {s: Fl.create(kestrel), cs: C.state(kestrel), ai: {mode: 'attack'}}; a.s.radius = 6; return a };
	const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
	const hurt = sk => { const a = ship(); a.cs.hull = a.cs.hullMax * 0.22; C.think(a, {p: [0, 0, 1000], v: [0, 0, 0], id: 'me'}, null, 0, seeded(3), sk); return a.ai.mode };
	ok('14. a badly hurt enemy (22%) flees a Pilot or a Rookie, but fights on against an Admiral (who makes them flee later)', hurt(1) == 'flee' && hurt(0.75) == 'flee' && hurt(1.25) == 'attack');
	const aim = sk => { const a = ship(); const c = C.think(a, {p: [40, 0, 1500], v: [0, 0, 0], id: 'me'}, null, 1, seeded(5), sk); return {fire: c.fire, wander: !!a.ai.wander, pitch: +c.pitch.toFixed(4), yaw: +c.yaw.toFixed(4)} };
	const a1 = aim(1), a0 = aim(undefined), aR = aim(0.75), aA = aim(1.25);
	ok('15. at skill 1 they fight as before (the same controls as no skill given, no wandering aim); a Rookie\'s enemies\' aim wanders', JSON.stringify(a1) == JSON.stringify(a0) && !a1.wander && aR.wander && (aR.pitch != a1.pitch || aR.yaw != a1.yaw), {a1, aR});
	const off = C.COMBAT.gimbalDeg * 1.1, cone = sk => { const a = ship(); a.s.q = Fl.create(kestrel).q; return C.think(a, {p: [Math.tan(off * Math.PI / 180) * 1500, 0, 1500], v: [0, 0, 0], id: 'me'}, null, 1, seeded(7), sk).fire };   /* (AI ships' guns are gimballed: just outside the gimbal's circle) */
	ok('16. an Admiral\'s enemies open fire on a wider line (just outside the gimbal\'s circle: they fire; at skill 1 they hold)', cone(1.25) === true && cone(1) === false, {hi: cone(1.25), mid: cone(1)});
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

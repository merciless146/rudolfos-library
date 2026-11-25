/* Ember Reach's artifacts, the ruins' finds (0.7.4, L4.3: artifacts.js; docs/plan-ember-reach-sites.md), in node:
   the vault always holds one and a structure one time in six; the four kinds in their shares; named from the site,
   the same in every save; inscriptions and relics worth their ranges (twice in the Rift); the record (at most 64, a
   find once); a star chart's marks; inscriptions sold with the data; an inscription returned; the excavation
   contract (offered by cartographers, completed only from the ground); and the save.
     node tests/emberreach_artifacts_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const Ar = req('artifacts.js'), X = req('explore.js'), St = req('sites.js'), G = req('galaxy.js'), En = req('encounters.js'), R = req('reputation.js'), Sv = req('save.js'), Tr = req('trade.js'), F = req('factions.js'), Wg = req('wing.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 600) : '')) } };
try {
	const site = i => ({id: 'site:W' + i + ' b:field', kind: 'field', seed: (i * 2654435761 + 7) >>> 0, world: 'W' + i + ' b'});
	/* 1-2. where finds are, and their kinds */
	const kinds = {}; let vault = 0, struct = 0;
	for (let i = 0; i < 8000; i++) { const f = Ar.findAt(site(i), 'v'); if (f) { vault++; kinds[f.k] = (kinds[f.k] || 0) + 1 } if (Ar.findAt(site(i), 3)) struct++ }
	const tot = 95, sh = k => kinds[k] / vault;
	ok('1. a vault always holds a find; a structure one time in six', vault == 8000 && Math.abs(struct / 8000 - 1 / 6) < 0.015, {vault, s: struct / 8000});
	ok('2. the kinds in their shares: star charts 35, inscriptions 30, devices 20, relics of note 10 (of 95)', Math.abs(sh('chart') - 35 / tot) < 0.02 && Math.abs(sh('inscription') - 30 / tot) < 0.02 && Math.abs(sh('device') - 20 / tot) < 0.02 && Math.abs(sh('relic') - 10 / tot) < 0.015, kinds);
	/* 3. names and worth */
	const a1 = Ar.make('s1', site(3), 'v', null), a1b = Ar.make('s1', site(3), 'v', null);
	const vals = {inscription: [], relic: []}, riftV = {inscription: [], relic: []};
	for (let i = 0; i < 3000; i++) { const f = Ar.findAt(site(i), 'v'); if (vals[f.k]) vals[f.k].push(f.v); const g = Ar.findAt(Object.assign(site(i), {rift: true}), 'v'); if (riftV[g.k]) riftV[g.k].push(g.v) }
	const within = (a, lo, hi) => a.length && Math.min(...a) >= lo && Math.max(...a) <= hi;
	ok('3. a find is named from its site, the same every time ("the … tablet"); inscriptions are worth 3,000-9,000 SU, relics 15,000-40,000, twice that from the Rift', JSON.stringify(a1) == JSON.stringify(a1b) && /^the [A-Z][a-z]+ /.test(Ar.nameOf(a1)) && Ar.nameOf(a1) == Ar.nameOf(a1b)
		&& within(vals.inscription, 3000, 9000) && within(vals.relic, 15000, 40000) && within(riftV.inscription, 6000, 18000) && within(riftV.relic, 30000, 80000), {name: Ar.nameOf(a1)});
	/* 4. the record */
	const P1 = Tr.newPlayer(F.majors()[0].id);
	const first = Ar.add(P1, a1), dup = Ar.add(P1, Object.assign({}, a1));
	for (let i = 0; i < 80; i++) Ar.add(P1, Object.assign({}, a1, {n: 'x' + i}));
	ok('4. into the record: a find of a place once; at most 64', first && !dup && P1.artifacts.length == 64);
	/* 5. a star chart's marks */
	const star = G.starsNear(20, 10, 0, 12).find(s => s.kind == 'star'), here = [star.x, star.y, star.z], all = X.ruinsNear(here, 30).filter(x => x.d > 0.01);
	const ch = {k: 'chart', s: star.id + '|site:x', n: 'v'}, marks = Ar.chartMarks(ch, here, X.ruinsNear, () => false), marks2 = Ar.chartMarks(ch, here, X.ruinsNear, sid => sid == all[0].star.id);
	ok('5. a star chart marks the one to three nearest ruins within 30 pc you haven\'t surveyed', marks.length >= 1 && marks.length <= 3 && marks.every((m, i) => m.star.id == all[i].star.id && m.d <= 30) && marks2.every(m => m.star.id != all[0].star.id) && marks2[0].star.id == all[1].star.id, {n: marks.length});
	/* 6. inscriptions sell with the data */
	const P2 = Tr.newPlayer(F.majors()[0].id); P2.artifacts = [{k: 'inscription', s: 'a|b', n: 'v', w: 'Q', h: null, v: 5000, r: 0}, {k: 'relic', s: 'a|c', n: 'v', w: 'Q', h: null, v: 20000, r: 0}];
	const u = X.unsold(P2), su = u.filter(x => x.kind == 'inscription').reduce((t, x) => t + x.su, 0), sale = X.sell(P2, null, 'SU', 10);
	ok('6. an inscription is among the data cartographers buy, at its worth; sold, it\'s gone (a relic stays: the broker\'s)', su == 5000 && sale.ok && sale.su == 5000 && P2.artifacts.length == 1 && P2.artifacts[0].k == 'relic', {su, sale});
	/* 7. returned */
	const P3 = Tr.newPlayer(F.majors()[0].id), who = F.majors()[3].id, r0 = P3.rep[who] || 0; R.act(P3, 'returnFind', who);
	ok('7. an inscription returned to the power whose space held its ruin raises standing with it', (P3.rep[who] || 0) > r0);
	/* 8-10. the excavation contract */
	const majors = F.majors(); let offer = null, portStar = null;
	for (const m of majors) { const ps = m.star; for (let d = 0; d < 40 && !offer; d++) { const o = X.offers(Tr.newPlayer(m.id), ps, {owner: m.id}, d).find(x => x.type == 'excavation'); if (o) { offer = o; portStar = ps } } if (offer) break }
	ok('8. cartographers offer excavations: a ruin field to survey from the ground (3,500 SU and 250 a parsec), the site named', offer && offer.kind == 'explore' && offer.site && /^site:.+:field$/.test(offer.site) && offer.planet && /Excavate the ruin field/.test(offer.text) && /three of its structures/.test(En.need(offer)), offer);
	if (offer) {
		const P4 = Tr.newPlayer(majors[0].id), acc = X.accept(P4, offer, 10), m = acc.mission, tstar = G.lookup ? G.lookup(offer.star.id, null) : null;
		X.surveyDone(P4, offer.star.id, offer.planet);
		const afterOrbit = !!m.surveyed;
		const fs = St.sitesAt(tstar, 0, {}).find(x => x.id == offer.site), Lo = St.layout(fs), sst = {id: offer.star.id};
		for (const s of Lo.structs.slice(0, 2)) X.siteMark(P4, sst, fs, St.BITS.struct(s.n), false, 11);
		X.groundDone(P4, sst, fs); const two = !!m.surveyed;
		for (const s of Lo.structs.slice(2, 3)) X.siteMark(P4, sst, fs, St.BITS.struct(s.n), false, 11);
		X.groundDone(P4, sst, fs); const three = !!m.surveyed;
		X.siteMark(P4, sst, fs, St.BITS.VAULT, false, 12); X.groundDone(P4, sst, fs);
		ok('9. an excavation isn\'t done from orbit, nor with fewer than three structures or the vault shut; three structures and the vault complete it', acc.ok && !afterOrbit && !two && (Lo.structs.length >= 3 ? !three : true) && m.surveyed && X.excavated(P4, offer.star.id, fs), {afterOrbit, two, three, n: Lo.structs.length});
		const packed = Wg.unpackMission(JSON.parse(JSON.stringify(Wg.packMission(m))));
		ok('10. an excavation can be shared in a wing (its site with it)', packed && packed.m.type == 'excavation' && packed.m.site == offer.site, packed && packed.m);
	} else { ok('9. (no excavation offered)', false); ok('10. (no excavation offered)', false) }
	/* 11. the save */
	const P5 = Tr.newPlayer(F.majors()[0].id); P5.artifacts = [Ar.make('s1', site(5), 'v', 'x'), {k: 'chart', s: 'a|b', n: '1', w: 'Q', h: null, v: 0, r: 0, m: ['s1', 's2']}, {k: 'bogus', s: 'a', n: 'v'}, {k: 'relic', s: 'a|b', n: 'v', w: 'Q', h: null, v: -5, r: 0}]; P5.study = 3;
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(P5)))), bad = Sv.unpackPlayer(JSON.parse(JSON.stringify(Object.assign(Sv.packPlayer(P5), {study: -1}))));
	ok('11. finds and the devices studied are saved and come back; unsound ones dropped', back.artifacts.length == 2 && back.artifacts[1].m.length == 2 && back.study == 3 && bad.study == 0, back.artifacts);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

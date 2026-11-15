/* ===== Ember Reach: surface contracts on the bulletin (L2.5, 0.3.10) =====
   A great power's port posts two kinds of work on the ground, in its own system and nearby ones (within 8 pc):
   - Deliveries: bring a load of food, machinery, water or medicine to a surface port (a camp, an outpost, a
     settlement, a starport, a forward base) and dock on one of its pads with it in the hold. They pay a premium:
     the goods' base value 1.5 to 2 times over (food and machinery at the top of that), plus 250 SU and 120 SU a
     parsec. Buy the goods where they're cheap.
   - Ground surveys: land on a world you can land on, in that system, and let the ground scan run (6 s, landed or
     under 2 km up). 800 SU plus 150 SU a parsec.
   A contract pays in the issuer's coin, is due in 12 days, and counts among the three missions you can hold;
   encounters.js settles it (and its standing) like the cartographers'. Each port's board changes daily.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const G = req('galaxy.js', 'EmberGalaxy'), F = req('factions.js', 'EmberFactions'), E = req('economy.js', 'EmberEconomy'), T = req('travel.js', 'EmberTravel'), Ld = req('landing.js', 'EmberLanding');
const CONTRACT = {range: 8, days: 12, tons: [5, 10, 20, 40], goods: {Food: [1.8, 2.0], Machinery: [1.8, 2.0], Water: [1.5, 1.7], Medicine: [1.5, 1.7]}, deliverBase: 250, deliverPc: 120, surveyBase: 800, surveyPc: 150, max: 3, perBoard: [2, 1]};
const at = s => [s.x, s.y, s.z];
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

/* the surface ports and landable worlds near a port (its own system first), cached per star */
const NEAR = new Map();
function nearby(star, day) {
	const k = star.id + ':' + Math.floor(day / 30);
	if (NEAR.has(k)) return NEAR.get(k);
	const p0 = at(star), ports = [], worlds = [];
	for (const s of [star, ...G.starsNear(p0[0], p0[1], p0[2], CONTRACT.range).filter(x => x.kind == 'star' && x.id != star.id).slice(0, 40)]) {
		if (s.rift || s.heart) continue;
		const d = Math.hypot(...at(s).map((v, i) => v - p0[i]));
		for (const q of T.portsAt(s, day)) if (q.surface && !q.lone) ports.push({star: s, q, d});
		for (const pl of G.system(s).planets) if (Ld.landable(pl).ok) worlds.push({star: s, pl, d});
	}
	const out = {ports, worlds};
	if (NEAR.size > 200) NEAR.clear();
	NEAR.set(k, out); return out;
}
/* today's surface work at a port (great powers' ports only) */
function offers(P, star, port, day) {
	if (!port || !port.owner || star.rift) return [];
	const o = F.byId(port.owner); if (!o || o.kind != 'major') return [];
	const r = G.rng(G.hashStr('surface work:' + star.id + ':' + (port.id || 'orbital') + ':' + Math.floor(day))), code = o.currency.code, rate = E.rate(code, Math.floor(day)), near = nearby(star, day), out = [];
	const dest = near.ports.filter(x => !(x.star.id == star.id && x.q.id == port.id));
	for (let k = 0; k < CONTRACT.perBoard[0] && dest.length; k++) {
		const x = dest.splice(Math.floor(r() * dest.length), 1)[0], good = pick(r, Object.keys(CONTRACT.goods)), tons = pick(r, CONTRACT.tons), [lo, hi] = CONTRACT.goods[good];
		const su = tons * E.GOODS[good] * (lo + (hi - lo) * r()) + CONTRACT.deliverBase + CONTRACT.deliverPc * x.d;
		out.push({id: 'sd:' + star.id + ':' + (port.id || 'orbital') + ':' + Math.floor(day) + ':' + k, kind: 'surface', type: 'delivery', issuer: o.id, star: {id: x.star.id, name: x.star.name, at: at(x.star)}, systemName: x.star.name,
			port: x.q.id, portName: x.q.name, world: x.q.world, good, tons, text: 'Deliver ' + tons + ' t of ' + good + ' to ' + x.q.name + (x.star.id == star.id ? '' : ' (' + x.star.name + ')'),
			reward: Math.round(su * rate), currency: code, dist: x.d, posted: Math.floor(day)});
	}
	for (let k = 0; k < CONTRACT.perBoard[1] && near.worlds.length; k++) {
		const x = pick(r, near.worlds);
		out.push({id: 'sg:' + star.id + ':' + (port.id || 'orbital') + ':' + Math.floor(day) + ':' + k, kind: 'surface', type: 'groundsurvey', issuer: o.id, star: {id: x.star.id, name: x.star.name, at: at(x.star)}, systemName: x.star.name,
			planet: x.pl.name, text: 'Ground survey of ' + x.pl.name + (x.star.id == star.id ? '' : ' (' + x.star.name + ')') + ': land and scan', reward: Math.round((CONTRACT.surveyBase + CONTRACT.surveyPc * x.d) * rate), currency: code, dist: x.d, posted: Math.floor(day)});
	}
	return out.filter(m => !(P.missions || []).some(x => x.id == m.id));
}
function accept(P, m, day) {
	P.missions = P.missions || [];
	if (P.missions.filter(x => !x.done).length >= CONTRACT.max) return {ok: false, why: 'You can hold three missions at once.'};
	const x = Object.assign({}, m, {accepted: Math.floor(day), due: Math.floor(day) + CONTRACT.days, done: false});
	P.missions.push(x);
	return {ok: true, mission: x};
}
/* docked at a port: hand over any delivery due there (the goods leave the hold). Returns the contracts delivered */
function deliverAt(P, starId, portId) {
	const out = [];
	for (const m of P.missions || []) {
		if (m.done || m.kind != 'surface' || m.type != 'delivery' || m.delivered || m.star.id != starId || m.port != portId) continue;
		if ((P.cargo[m.good] || 0) < m.tons) continue;
		P.cargo[m.good] -= m.tons; if (!P.cargo[m.good]) { delete P.cargo[m.good]; if (P.cost) delete P.cost[m.good] }
		m.delivered = true; out.push(m);
	}
	return out;
}
/* a ground scan finished on a world: the surveys it completes */
function scanned(P, starId, world) {
	const out = [];
	for (const m of P.missions || []) if (!m.done && m.kind == 'surface' && m.type == 'groundsurvey' && !m.surveyed && m.star.id == starId && m.planet == world) { m.surveyed = true; out.push(m) }
	return out;
}
/* what's left to do, for the HUD and the status screen */
function need(m) {
	if (m.type == 'delivery') return m.delivered ? 'Delivered: dock anywhere to be paid' : 'Deliver ' + m.tons + ' t of ' + m.good + ' to ' + m.portName + ' (' + m.world + ', ' + m.star.name + '): dock on a pad with it aboard';
	return m.surveyed ? 'Surveyed: dock anywhere to be paid' : 'Land on ' + m.planet + ' at ' + m.star.name + ' and let the ground scan run';
}

const EmberContracts = {CONTRACT, nearby, offers, accept, deliverAt, scanned, need};
if (isNode) module.exports = EmberContracts; else root.EmberContracts = EmberContracts;
})(typeof window != 'undefined' ? window : this);

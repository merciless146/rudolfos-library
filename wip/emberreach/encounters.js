/* ===== Ember Reach: who you meet, who shoots, and what it costs (docs/plan-ember-reach.md, "Combat", "War", M4).
   - Encounters: on arrival in a system, a cast drawn from where it is and when: a port's patrol and its traders;
     pirates (most often in unclaimed space and on the fronts, always where a criminal gang's flagship lies);
     war wings of both sides in contested systems where the fighting is; the small factions' fleet carriers and
     dreadnoughts where they are that season; and the enemies a player's war missions send them to.
   - Hostility: pirates attack anyone who isn't their friend; a power's ships attack its enemies (Unfriendly pilots,
     pilots with a commission against it), patrols attack wanted pilots, and anyone attacks who has been shot at.
   - Consequences: a pirate's death pays a bounty and pleases the space's owner; killing anyone else angers their
     faction and, if they never shot first, puts a bounty on you; in a contested system, killing the enemy's ships
     counts as war effort for the other side.
   - War missions: taken at a port's bulletin (up to 3 at once), done in the mission's system within 10 days, paid
     and played into the war through EmberReputation.warEffort.
   Deterministic from (star, day, visit). GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const F = req('factions.js', 'EmberFactions'), R = req('reputation.js', 'EmberReputation'), S = req('ships.js', 'EmberShips'), T = req('travel.js', 'EmberTravel'), E = req('economy.js', 'EmberEconomy');

const ENC = {pirateOdds: {unclaimed: 0.5, contested: 0.45, claimed: 0.18, capital: 0.04}, missionDays: 10, maxMissions: 3, kills: 3, reconTime: 30, supplyTons: 5, bountyShare: 0.01, gangHarm: 40};
const NEEDS = {strike: 'kills', blockade: 'kills', defend: 'kills', escort: 'kills', recon: 'stay', sabotage: 'depot', supply: 'deliver', survey: 'surveyed', ruin: 'surveyed'};
/* a depot: a target that doesn't fly or shoot */
const DEPOT = {id: 'depot', name: 'Supply depot', size: 'L', role: 'depot', hull: 6000, shield: 1500, speed: 0, agility: 0, cargo: 0, jump: 0, hard: [0, 0, 0, 0], length: 120, value: 0, who: []};

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
function rng(seed) { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const pick = (a, r) => a[Math.floor(r() * a.length)];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Capital'];
/* ships for a part, at most a size; a power's navy prefers its own yards */
function hulls(role, maxSize, maker) {
	const all = S.ships().filter(s => s.who.includes(role) && SIZES.indexOf(s.size) <= SIZES.indexOf(maxSize));
	const own = maker ? all.filter(s => s.maker == maker) : [];
	return own.length ? own : all;
}
const currencyOf = id => { const f = id && F.byId(id); return f && f.currency && f.currency.code && f.currency.code.length == 3 && f.kind == 'major' ? f.currency.code : null };

/* the cast at a star on a day. ctx: {port (portFor result or null), visit (a count, so each arrival differs), missions} */
function cast(star, day, P, ctx) {
	ctx = ctx || {};
	const r = rng(hash('enc:' + star.id + ':' + day + ':' + (ctx.visit || 0))), out = [];
	let n = 0;
	const add = (o) => { o.id = 'n' + (n++); o.provoked = false; out.push(o); return o };
	const capital = F.majors().find(m => m.star.id == star.id);
	const own = capital ? {owner: capital.id, contested: false} : T.ownerOf(star, day);
	const port = ctx.port;
	/* a port's patrol and traffic */
	if (port && port.owner && F.byId(port.owner).kind == 'major') {
		const k = 1 + Math.floor(r() * 2) + (capital ? 1 : 0);
		for (let i = 0; i < k; i++) add({role: 'patrol', faction: port.owner, ship: pick(hulls('navy', capital ? 'L' : 'M', port.owner), r), where: 'port', range: 3000 + r() * 4000, ai: 'patrol'});
		for (let i = 0, t = Math.floor(r() * 3); i < t; i++) add({role: 'trader', faction: port.owner, ship: pick(hulls('trader', 'L'), r), where: 'port', range: 6000 + r() * 8000, ai: 'trade'});
	}
	/* small factions where they are this season */
	let gang = null;
	for (const m of F.minors()) {
		const w = F.whereIs(m, day);
		if (w.moving || !w.site || w.site.id != star.id || !m.carrier) continue;
		const hull = m.carrier.class == 'dreadnought' ? 'tyrant' : 'bastion';
		add({role: 'flagship', faction: m.id, ship: S.ships().find(s => s.id == hull), name: m.carrier.name, where: 'arrival', range: 40000, ai: 'hold'});
		if (m.type == 'criminal') gang = m;
	}
	/* pirates */
	const odds = gang ? 0.9 : capital ? ENC.pirateOdds.capital : own.contested ? ENC.pirateOdds.contested : own.owner ? ENC.pirateOdds.claimed : ENC.pirateOdds.unclaimed;
	if (r() < odds) {
		const crew = gang || pick(F.minors().filter(m => m.type == 'criminal'), r), k = 1 + Math.floor(r() * (own.owner && !own.contested ? 2 : 3));
		for (let i = 0; i < k; i++) add({role: 'pirate', faction: crew.id, ship: pick(hulls('pirate', i == 0 && r() < 0.3 ? 'L' : 'M'), r), where: 'arrival', range: 6000 + r() * 6000, ai: 'attack', wing: 'p'});
	}
	/* war wings where the fighting is */
	if (own.contested && own.war) {
		const w = F.wars().find(x => x.id == own.war), h = F.contestedHolder(T.at(star), day, P && P.warEvents);
		if (w && (h.fighting || r() < 0.35)) for (const side of [w.a, w.b]) {
			const k = 2 + Math.floor(r() * 2);
			for (let i = 0; i < k; i++) add({role: 'navy', faction: side, ship: pick(hulls('navy', 'L', side), r), where: 'arrival', range: 15000 + r() * 5000, ai: 'attack', wing: side, war: w.id});
		}
	}
	/* what the player's war missions bring here */
	for (const m of (P && P.missions) || []) {
		if (m.star.id != star.id || m.done) continue;
		const need = NEEDS[m.type];
		if (need == 'kills') for (let i = 0; i < ENC.kills - (m.kills || 0); i++) add({role: 'navy', faction: m.against, ship: pick(hulls('navy', 'M', m.against), r), where: 'arrival', range: 9000 + r() * 4000, ai: 'attack', wing: m.against, war: m.war, mission: m.id});
		if (need == 'depot') { add({role: 'depot', faction: m.against, ship: DEPOT, where: 'arrival', range: 12000, ai: 'hold', mission: m.id}); add({role: 'navy', faction: m.against, ship: pick(hulls('navy', 'S', m.against), r), where: 'arrival', range: 11000, ai: 'patrol', wing: m.against, war: m.war}) }
	}
	return out;
}

/* will this ship attack the player? */
function hostile(P, npc, ctx) {
	if (npc.provoked) return true;
	if (npc.role == 'sentinel') return true;   /* the old defences around ruins answer to nobody living */
	if (npc.role == 'trader' || npc.role == 'depot') return false;
	const rep = P.rep[npc.faction] || 0;
	if (npc.role == 'pirate') return rep < 500;
	if (R.hostile(P, npc.faction)) return true;
	/* a port's patrol arrests the wanted */
	if (npc.role == 'patrol') { const c = currencyOf(npc.faction); if (c && (P.bounties[c] || 0) > 0) return true }
	/* a war mission against them makes you their enemy in that system */
	if (npc.mission) return true;
	return false;
}
/* is this NPC an enemy of that one? (the player is {player: true}) */
function enemies(a, b, P) {
	if (b.player) return hostile(P, a);
	if (a.player) return hostile(P, b);
	if (a.role == 'depot' || b.role == 'depot' || a.role == 'sentinel' || b.role == 'sentinel' || a.role == 'flagship' && b.role == 'flagship') return false;
	if (a.role == 'pirate' || b.role == 'pirate') return (a.role == 'pirate') != (b.role == 'pirate');
	if (a.faction == b.faction) return false;
	const fa = F.byId(a.faction), fb = F.byId(b.faction);
	return !!(fa && fb && fa.kind == 'major' && fb.kind == 'major' && F.relation(a.faction, b.faction) < 0 && (a.war || b.war));
}

/* the player destroyed an NPC: reputation, bounty (theirs, or yours), war effort, mission progress. ctx: {star, day,
   own: ownerOf result} */
function killed(P, npc, ctx) {
	const day = ctx.day, star = ctx.star, own = ctx.own || {}, msg = [], pay = [];
	const f = F.byId(npc.faction), value = npc.ship.value || 0;
	if (npc.wasHostile == null) npc.wasHostile = !npc.provokedByPlayer && hostile(P, npc);
	/* a warrant scan pays the bounties every jurisdiction has on them */
	const warrant = npc.scanned && npc.scanned.warrant && npc.wanted;
	if (npc.role == 'sentinel') msg.push('An old defence falls silent');
	else if (npc.role != 'pirate' && npc.wanted && npc.role != 'depot') {
		/* a wanted ship: no crime to kill it; its bounty is paid if you scanned the warrant */
		if (warrant) { P.wallet[npc.wanted.code] = (P.wallet[npc.wanted.code] || 0) + npc.wanted.amount; pay.push({code: npc.wanted.code, amount: npc.wanted.amount}); msg.push('Warrant claimed: ' + npc.wanted.amount.toLocaleString('en') + ' ' + npc.wanted.code) }
		else msg.push('They were wanted: no crime. (A warrant scan first would have paid their bounty.)');
	}
	else if (npc.role == 'pirate') {
		if (warrant) { const extra = Math.round(npc.wanted.amount * 0.5); P.wallet[npc.wanted.code] = (P.wallet[npc.wanted.code] || 0) + extra; msg.push('Warrants from other jurisdictions: ' + extra.toLocaleString('en') + ' ' + npc.wanted.code) }
		const owner = own.owner || P.origin, code = currencyOf(owner) || currencyOf(P.origin), amount = Math.round(Math.max(50, value * ENC.bountyShare) * E.rate(code, day));
		P.wallet[code] = (P.wallet[code] || 0) + amount; pay.push({code, amount});
		if (own.owner) R.act(P, 'killPirate', own.owner);
		P.rep[npc.faction] = Math.max(-1000, (P.rep[npc.faction] || 0) - ENC.gangHarm);
		msg.push('Bounty paid: ' + amount.toLocaleString('en') + ' ' + code);
	} else if (npc.war && npc.wasHostile && !npc.provokedByPlayer) {
		const w = F.wars().find(x => x.id == npc.war), forSide = w.a == npc.faction ? w.b : w.a;
		const key = own.contested ? F.contestedHolder(T.at(star), day, P.warEvents).key : (npc.mission && (P.missions.find(m => m.id == npc.mission) || {}).system);
		if (key) { R.warKill(P, w.id, key, forSide, day); msg.push('War effort for the ' + F.byId(forSide).name.replace(/^The /, '')) }
		else R.act(P, 'killShipAtWar', npc.faction);
	} else if (npc.role != 'depot') {
		/* they shot first: no bounty, but their people won't forget */
		if (npc.wasHostile && !npc.provokedByPlayer) R.act(P, 'killShipAtWar', npc.faction);
		else { R.act(P, 'killShip', npc.faction, {where: T.at(star)}); msg.push('Crime: you destroyed a ' + (f ? f.name.replace(/^The /, '') + ' ' : '') + 'ship. A bounty is on you.') }
	}
	/* missions */
	for (const m of P.missions || []) {
		if (m.done || m.star.id != star.id) continue;
		if (npc.mission == m.id || (NEEDS[m.type] == 'kills' && npc.faction == m.against && npc.role != 'depot')) { if (NEEDS[m.type] == 'kills') m.kills = (m.kills || 0) + 1; if (NEEDS[m.type] == 'depot' && npc.role == 'depot') m.depot = true }
	}
	return {msg, pay};
}
/* the player fired on someone who wasn't hostile: they (and their wing) turn on you */
function provoke(npc, all) {
	for (const o of all) if (o == npc || (o.faction == npc.faction && (o.role == npc.role || o.role == 'patrol'))) { if (!o.provoked) { o.provoked = true; o.provokedByPlayer = true } }
}

/* ---------- war missions ---------- */
function offers(P, port, day) {
	if (!port || !port.owner || F.byId(port.owner).kind != 'major') return [];
	const taken = new Set((P.missions || []).map(m => m.id));
	/* the war office quotes in standard units; it pays in its own coin */
	return F.warMissions(port.owner, day, P.warEvents).filter(m => !taken.has(m.id)).slice(0, 5).map(m => Object.assign({}, m, {reward: Math.round(m.reward * E.rate(m.currency, day))}));
}
function missionStar(m) { const w = F.wars().find(x => x.id == m.war), s = w && w.systems.find(x => x.id == m.system); return s ? {id: s.id, name: s.name, at: s.at} : null }
function accept(P, m, day) {
	P.missions = P.missions || [];
	if (P.missions.filter(x => !x.done).length >= ENC.maxMissions) return {ok: false, why: 'You can hold three war missions at once.'};
	const star = missionStar(m); if (!star) return {ok: false, why: 'That front has moved.'};
	const need = NEEDS[m.type];
	if (need == 'deliver' && (P.cargo.Munitions || 0) < ENC.supplyTons) return {ok: false, why: 'Load ' + ENC.supplyTons + ' t of Munitions first.'};
	const x = Object.assign({}, m, {star, accepted: day, due: day + ENC.missionDays, kills: 0, stay: 0, depot: false, done: false});
	P.missions.push(x);
	return {ok: true, mission: x};
}
/* what's left to do */
function need(m) {
	const k = NEEDS[m.type];
	if (k == 'kills') return Math.max(0, ENC.kills - m.kills) + ' ' + F.byId(m.against).name.replace(/^The /, '') + ' ship' + (ENC.kills - m.kills == 1 ? '' : 's') + ' to destroy at ' + m.star.name;
	if (k == 'stay') return 'Scan at ' + m.star.name + ': ' + Math.max(0, Math.ceil(ENC.reconTime - m.stay)) + ' s in the system';
	if (k == 'depot') return 'Destroy the depot at ' + m.star.name;
	if (k == 'surveyed') return 'Survey ' + m.planet + ' at ' + m.star.name + ': fly within 6 radii with it targeted, for 12 s';
	return 'Deliver ' + ENC.supplyTons + ' t of Munitions to a port at ' + m.star.name;
}
/* progress that isn't a kill: time in a system, docking with munitions */
function tick(P, starId, dt, docked) {
	for (const m of P.missions || []) {
		if (m.done || m.star.id != starId) continue;
		if (NEEDS[m.type] == 'stay') m.stay += dt;
		if (NEEDS[m.type] == 'deliver' && docked && (P.cargo.Munitions || 0) >= ENC.supplyTons) { P.cargo.Munitions -= ENC.supplyTons; if (!P.cargo.Munitions) delete P.cargo.Munitions; m.delivered = true }
	}
}
const complete = m => NEEDS[m.type] == 'surveyed' ? !!m.surveyed : NEEDS[m.type] == 'kills' ? m.kills >= ENC.kills : NEEDS[m.type] == 'stay' ? m.stay >= ENC.reconTime : NEEDS[m.type] == 'depot' ? m.depot : !!m.delivered;
/* finished missions pay and play into the war; late ones fail. Returns [{mission, ok, text}] */
function settle(P, day) {
	const out = [];
	for (const m of P.missions || []) {
		if (m.done) continue;
		if (complete(m)) {
			/* war missions play into the front; exploration contracts are paid and please the issuer */
			if (m.war) R.warEffort(P, m, day); else { R.act(P, 'mission', m.issuer); P.wallet[m.currency] = (P.wallet[m.currency] || 0) + m.reward }
			m.done = true; out.push({mission: m, ok: true, text: 'Mission complete: ' + m.text + '. Paid ' + m.reward.toLocaleString('en') + ' ' + m.currency});
		}
		else if (day > m.due) { R.act(P, 'missionFailed', m.issuer); m.done = true; out.push({mission: m, ok: false, text: 'Mission failed: ' + m.text}) }
	}
	P.missions = (P.missions || []).filter(m => !m.done);
	return out;
}

const EmberEncounters = {ENC, NEEDS, DEPOT, cast, hostile, enemies, killed, provoke, offers, missionStar, accept, need, tick, complete, settle};
if (isNode) module.exports = EmberEncounters; else root.EmberEncounters = EmberEncounters;
})(typeof window != 'undefined' ? window : this);

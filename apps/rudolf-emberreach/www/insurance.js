/* ===== Ember Reach: ship insurance, and where a lost ship's pilot wakes up =====
   - A policy is taken out with a great power, at one of its ports (Contacts), and is paid in its currency:
     10% of the ship's whole value (hull and everything fitted) every week, a week in advance.
   - A premium that can't be paid when it falls due is owed. It's taken as soon as there's money in that currency.
   - When the ship is lost, the pilot wakes up at the nearest port within 1,000 ly that trades in the policy's
     currency. Failing that, the nearest port whose exchange takes that currency. Failing that too, the station
     they started the game at.
   - Anything owed on the policy is settled there: from the policy's currency, and if that's short, the port's
     exchange changes the pilot's other money (whatever it will take) into it.
   - Paid up, the insurer replaces the ship as it was (hull and fit; the cargo is lost). Not paid up, or not
     insured, the pilot starts again at their starting station in a basic starter ship, with the starter's cover.
   - Every pilot starts with that cover: their home power's, the first week paid.
   - Lost in the Rift: the search starts from the Maw, this side (no power reaches the Rift).
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const G = req('galaxy.js', 'EmberGalaxy'), F = req('factions.js', 'EmberFactions'), E = req('economy.js', 'EmberEconomy'),
	T = req('travel.js', 'EmberTravel'), S = req('ships.js', 'EmberShips'), O = req('outfit.js', 'EmberOutfit'), R = req('reputation.js', 'EmberReputation');
const INSURE = {weekly: 0.10, week: 7, reachLy: 1000, ly: 3.26156, local: 6};
const reachPc = () => INSURE.reachLy / INSURE.ly;   /* (read when asked, so a test can narrow it) */

/* the ship's whole value (SU): its hull, and what's fitted beyond the stock modules */
const shipValue = (hull, fit) => S.value(hull) + (fit ? O.extra(hull, fit) : 0);
const issuerOf = code => F.majors().find(m => m.currency.code == code) || null;
/* a week's premium, in the policy's currency */
function premium(P, hull, fit, day) { const c = P.insurance ? P.insurance.code : F.byId(P.origin).currency.code; return {code: c, amount: INSURE.weekly * shipValue(hull, fit) * E.rate(c, day)} }

/* every pilot starts covered: their home power's policy, the first week paid */
function starterCover(P, day) { const o = F.byId(P.origin); return {provider: o.id, code: o.currency.code, since: day, paidTo: day + INSURE.week, owed: 0} }
function ensure(P, day) { if (P.insurance === undefined) P.insurance = starterCover(P, day || 0); return P.insurance }

/* take out (or switch to) a policy with the power holding this port: the first week is paid now */
function insure(P, holder, hull, fit, day) {
	const m = F.byId(holder); if (!m || m.kind != 'major') return {ok: false, why: 'Only a great power\'s port sells insurance.'};
	if (P.insurance && P.insurance.owed > 0) return {ok: false, why: 'Settle what you owe on your policy first.'};
	const code = m.currency.code, amt = INSURE.weekly * shipValue(hull, fit) * E.rate(code, day);
	if ((P.wallet[code] || 0) + 1e-9 < amt) return {ok: false, why: 'The first week\'s premium is ' + Math.round(amt).toLocaleString('en-US') + ' ' + code + '.'};
	P.wallet[code] -= amt;
	P.insurance = {provider: m.id, code, since: day, paidTo: day + INSURE.week, owed: 0};
	return {ok: true, amount: amt, code};
}
function cancel(P) { P.insurance = null; return {ok: true} }

/* the weeks fall due: each premium taken if the money's there, owed if not (what's owed is taken first) */
function tick(P, hull, fit, day) {
	const I = ensure(P, day), out = []; if (!I) return out;
	const pay = () => { const take = Math.min(I.owed, P.wallet[I.code] || 0); if (take > 0) { P.wallet[I.code] -= take; I.owed -= take; if (I.owed < 1e-6) I.owed = 0 } };
	pay();
	let weeks = 0;
	while (I.paidTo <= day && weeks < 520) {
		const amt = premium(P, hull, fit, I.paidTo).amount;
		if ((P.wallet[I.code] || 0) + 1e-9 >= amt && I.owed == 0) P.wallet[I.code] -= amt; else I.owed += amt;
		I.paidTo += INSURE.week; weeks++;
	}
	if (weeks) out.push(I.owed > 0 ? {ok: false, text: 'Insurance: ' + Math.round(I.owed).toLocaleString('en-US') + ' ' + I.code + ' owed on your policy. A claim will need it settled.'} : {ok: true, text: 'Insurance: ' + weeks + ' week' + (weeks > 1 ? 's\'' : '\'s') + ' premium paid (' + I.code + ')'});
	return out;
}

/* ---------- where a pilot wakes up ----------
   Ports to consider: every great power's capital and lane hubs, your colonies, your last port and your start, and
   any port within a few parsecs. For each, who holds it and what money it trades in. */
function candidates(at, ctx, day) {
	const out = [], seen = new Set();
	const add = (star) => {
		if (!star || seen.has(star.id) || star.rift || star.heart) return; seen.add(star.id);
		const d = Math.hypot(star.x - at[0], star.y - at[1], star.z - at[2]); if (d > reachPc()) return;
		const port = T.portFor(star, day); if (!port) return;
		const own = T.ownerOf(star, day), holder = own.contested ? null : own.owner, m = holder && F.byId(holder);
		out.push({star, port, d, holder: m && m.kind == 'major' ? holder : null, code: m && m.kind == 'major' ? m.currency.code : null});
	};
	for (const n of T.lanes().nodes) add(n.star);
	for (const s of (ctx && ctx.stars) || []) add(s);
	/* (within a few parsecs, or fewer where stars crowd: at the core a few parsecs hold millions) */
	const Rl = Math.min(INSURE.local, Math.cbrt(400 / ((G.numberDensity(at[0], at[1], at[2]) + 1e-9) * 4.19)));
	G.inRealm('normal', () => G.starsNear(at[0], at[1], at[2], Rl)).filter(s => s.kind == 'star').slice(0, 400).forEach(add);
	return out.sort((a, b) => a.d - b.d);
}
/* whether a port's exchange will take a currency: a power's exchange takes anything but its enemies' */
function exchangeTakes(holder, code) { if (!holder) return false; const i = issuerOf(code); return !!i && (i.id == holder || F.relation(holder, i.id) >= 0) }
function respawnAt(P, at, ctx, day) {
	const I = P.insurance, start = ctx.start;
	if (!I) return {star: start, why: 'start', uninsured: true, holder: ctx.startHolder};
	const list = candidates(at, ctx, day);
	const own = list.find(c => c.code == I.code); if (own) return {star: own.star, why: 'currency', d: own.d, holder: own.holder};
	const ex = list.find(c => exchangeTakes(c.holder, I.code)); if (ex) return {star: ex.star, why: 'exchange', d: ex.d, holder: ex.holder};
	return {star: start, why: 'start', holder: ctx.startHolder};
}

/* settle what's owed at the port's exchange: the policy's currency first, then the rest, largest first */
function settle(P, holder, day) {
	const I = P.insurance; if (!I || I.owed <= 0) return {ok: true, paid: 0, changed: []};
	let need = I.owed; const changed = [], plan = [];
	const own = Math.min(need, P.wallet[I.code] || 0); plan.push([I.code, own, own]); need -= own;
	if (need > 1e-6 && holder) {
		const others = Object.entries(P.wallet).filter(([c, a]) => c != I.code && a > 0).map(([c, a]) => { const r = E.exchange(1, c, I.code, day, holder); return r.ok ? {c, a, per: r.amount} : null }).filter(Boolean).sort((x, y) => y.a * y.per - x.a * x.per);
		for (const o of others) { if (need <= 1e-6) break; const use = Math.min(o.a, need / o.per); plan.push([o.c, use, use * o.per]); need -= use * o.per }
	}
	if (need > 1e-6) return {ok: false, short: need, code: I.code};
	for (const [c, use, got] of plan) { if (use <= 0) continue; P.wallet[c] -= use; if (c != I.code) changed.push({from: c, amount: use, got}) }
	const paid = I.owed; I.owed = 0;
	return {ok: true, paid, changed};
}

/* the ship is lost: where the pilot wakes, and in what */
function claim(P, hull, fit, at, ctx, day) {
	ensure(P, day);
	const where = respawnAt(P, at, ctx, day), I = P.insurance;
	const starter = () => { const model = R.newPlayer(P.origin).ship.model; P.ship.model = model; P.ship.fit = null; P.insurance = starterCover(P, day); return {star: ctx.start, model, starter: true} };
	if (!I) return Object.assign(starter(), {why: 'uninsured'});
	const st = settle(P, where.holder, day);
	if (!st.ok) return Object.assign(starter(), {why: 'unpaid', short: st.short, code: I.code});
	return {star: where.star, model: hull.id, starter: false, why: where.why, paid: st.paid, changed: st.changed, code: I.code};
}

const EmberInsurance = {INSURE, shipValue, premium, starterCover, ensure, insure, cancel, tick, candidates, exchangeTakes, respawnAt, settle, claim};
if (isNode) module.exports = EmberInsurance; else root.EmberInsurance = EmberInsurance;
})(typeof window != 'undefined' ? window : globalThis);

/* ===== Ember Reach: a pilot's career: difficulty and Hardcore (0.5.6; docs/plan-ember-reach-pilots.md, P2).
   Difficulty: Rookie, Pilot or Admiral, chosen when the pilot is made and changed later while docked. It sets how
   well enemies fight the pilot (skill), the damage the pilot takes, the insurance premium, and the rewards.
   Hardcore (P.hc): 'on' only when the pilot is made; 'off' once turned off by hand (never on again; an ordinary
   pilot from then on); 'done' when the main questline is finished on Hardcore (its rewards and the Contraband
   Merchant stay, its risk ends); 'none' for a pilot made without it. While it's on, the pilot is an Admiral and
   dying wipes the pilot. Its rewards: 1.5 times, on top of the difficulty's, while 'on' or 'done'.
   Trade is never multiplied (the markets are the galaxy's, the same for every pilot).
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const DIFFS = ['rookie', 'pilot', 'admiral'];
/* starting values for playtests */
const DIFF = {
	rookie: {name: 'Rookie', skill: 0.75, taken: 0.7, premium: 0.6, reward: 0.75},
	pilot: {name: 'Pilot', skill: 1, taken: 1, premium: 1, reward: 1},
	admiral: {name: 'Admiral', skill: 1.25, taken: 1.3, premium: 1.5, reward: 1.25}};
const HC = {reward: 1.5};
const HCS = ['none', 'on', 'off', 'done'];
const diffOf = P => P && DIFF[P.diff] ? P.diff : 'pilot';
const hcOf = P => P && HCS.includes(P.hc) ? P.hc : 'none';
/* Hardcore's rewards and its merchant: while on, and after the questline finished on it */
const hcPerks = P => hcOf(P) == 'on' || hcOf(P) == 'done';
/* the multipliers */
const rewardK = P => DIFF[diffOf(P)].reward * (hcPerks(P) ? HC.reward : 1);
const takenK = P => DIFF[diffOf(P)].taken;
const premiumK = P => DIFF[diffOf(P)].premium;
const skill = P => DIFF[diffOf(P)].skill;
/* a payout scaled for the pilot (rounded to whole coins when it was whole) */
const reward = (P, amount) => { const v = amount * rewardK(P); return Number.isInteger(amount) ? Math.round(v) : v };
/* a new pilot's choices, made sound: a name (2-24 letters, digits, spaces, apostrophes, hyphens; none is fine), the
   difficulty, and Hardcore, which makes the pilot an Admiral */
const cleanName = t => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return /^[\p{L}\p{N}][\p{L}\p{N} '\-]{1,23}$/u.test(s) ? s : '' };
function make(P, o) {
	o = o || {};
	P.name = cleanName(o.name);
	P.hc = o.hardcore ? 'on' : 'none';
	P.diff = P.hc == 'on' ? 'admiral' : DIFF[o.diff] ? o.diff : 'pilot';
	return P;
}
/* changing the difficulty: only while docked, and not while Hardcore holds the pilot at Admiral */
function canChangeDiff(P, docked) {
	if (hcOf(P) == 'on') return {ok: false, why: 'A Hardcore pilot is an Admiral until Hardcore ends.'};
	if (!docked) return {ok: false, why: 'The difficulty can be changed while docked.'};
	return {ok: true};
}
function setDiff(P, d, docked) { const c = canChangeDiff(P, docked); if (!c.ok) return c; if (!DIFF[d]) return {ok: false, why: 'No such difficulty.'}; P.diff = d; return {ok: true} }
/* Hardcore turned off by hand: for good */
function hcOff(P) { if (hcOf(P) != 'on') return {ok: false, why: 'Hardcore isn\'t on.'}; P.hc = 'off'; return {ok: true} }
/* the main questline finished on Hardcore (the Core's story, M6): Hardcore ends, its perks stay; the cloak is the
   questline's to give */
function hcFinish(P) { if (hcOf(P) != 'on') return false; P.hc = 'done'; return true }
/* does losing the ship end this pilot? */
const diesForGood = P => hcOf(P) == 'on';
/* the saved fields, checked */
function unpack(x, P) {
	P.name = cleanName(x && x.name); P.diff = x && DIFF[x.diff] ? x.diff : 'pilot'; P.hc = x && HCS.includes(x.hc) ? x.hc : 'none';
	if (P.hc == 'on') P.diff = 'admiral';
	return P;
}
const label = P => DIFF[diffOf(P)].name + (hcOf(P) == 'on' ? ' · Hardcore' : hcOf(P) == 'done' ? ' · Hardcore, finished' : '');

const EmberCareer = {DIFFS, DIFF, HC, HCS, diffOf, hcOf, hcPerks, rewardK, takenK, premiumK, skill, reward, cleanName, make, canChangeDiff, setDiff, hcOff, hcFinish, diesForGood, unpack, label};
if (typeof module != 'undefined') module.exports = EmberCareer; else root.EmberCareer = EmberCareer;
})(typeof window != 'undefined' ? window : globalThis);

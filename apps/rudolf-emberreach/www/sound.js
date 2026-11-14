/* ===== Ember Reach: sound, made here with Web Audio (no sound files, so it costs almost nothing to download).
   Continuous layers follow the flight every frame (EmberSound.update):
   - the main drive: a low roar and rumble, louder with thrust, higher with speed;
   - the side and attitude thrusters (RCS, ACS): a hiss that puffs with every correction flight assist makes;
   - cruise: a drone that climbs with the cruise speed;
   - a quiet cockpit hum.
   Under g with the canopy broken, everything muffles as the strain rises and a heartbeat comes in; a blackout is
   near silence. One-off cues (EmberSound.cue): (M4) gunfire, hits on shields and hull, explosions, missile lock and
   incoming-missile warnings; alerts (orange: two tones; red: three fast), clearance, docking,
   collisions, cruise spool-up and drop-out, flight assist on and off, targeting.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const A = window.EmberSound = {on: true};
let C = null, master, muffle, bus, noiseBuf, L = null, held = false, beatAt = 0;
/* the mix (Settings): master, engines and ambience (the layers), effects (the cues), alerts and warnings */
let eng, fx, alr, dest, VOL = {master: 80, engines: 80, effects: 80, alerts: 100};
const MASTER = 0.6, ALERTS = ['warning', 'critical', 'clearance', 'refused', 'lock', 'incoming', 'blackout'];
const mv = () => A.on ? MASTER * VOL.master / 80 : 0;
function ctx() {
	if (C) { if (C.state == 'suspended' && !held) C.resume().catch(() => {}); return C }
	try { C = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { return null }
	master = C.createGain(); master.gain.value = mv(); master.connect(C.destination);
	muffle = C.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000; muffle.Q.value = 0.5;
	const comp = C.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
	muffle.connect(comp); comp.connect(master);
	bus = C.createGain(); bus.gain.value = 1; bus.connect(muffle);
	eng = C.createGain(); eng.connect(bus); fx = C.createGain(); fx.connect(bus); alr = C.createGain(); alr.connect(bus); mix(); dest = fx;
	noiseBuf = C.createBuffer(1, C.sampleRate * 2, C.sampleRate);
	const d = noiseBuf.getChannelData(0); let s = 7, b = 0;
	for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; const w = s / 1073741823.5 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.5 + b * 3 }
	layers();
	return C;
}
const noiseSrc = () => { const s = C.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s };
function filt(type, f, q) { const x = C.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q || 0.7; return x }
function gain(v) { const g = C.createGain(); g.gain.value = v; return g }
/* the continuous layers, started once and steered by update() */
function layers() {
	L = {};
	/* main drive: filtered noise plus two detuned saws */
	L.drive = gain(0); L.drive.connect(eng);
	L.driveF = filt('lowpass', 220, 0.9); L.driveF.connect(L.drive);
	const n1 = noiseSrc(); n1.connect(L.driveF); n1.start();
	L.saw = [55, 55.7].map(f => { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = gain(0.05); o.connect(g); g.connect(L.driveF); o.start(); return o });
	/* thrusters: band-passed hiss */
	L.rcs = gain(0); L.rcs.connect(eng);
	const rf = filt('bandpass', 1700, 1.2); rf.connect(L.rcs); const n2 = noiseSrc(); n2.playbackRate.value = 1.3; n2.connect(rf); n2.start();
	/* cruise: a drone with a slow beat */
	L.cruise = gain(0); L.cruise.connect(eng);
	L.cz = [110, 110.6, 165].map(f => { const o = C.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(L.cruise); o.start(); return o });
	/* cockpit hum */
	L.hum = gain(0.012); L.hum.connect(eng);
	const h = C.createOscillator(); h.type = 'sine'; h.frequency.value = 60; h.connect(L.hum); h.start();
}
const set = (p, v, tc) => p.setTargetAtTime(v, C.currentTime, tc || 0.06);

A.unlock = () => ctx();
A.setOn = on => { A.on = on; if (C) set(master.gain, mv(), 0.05) };
function mix() { if (!C) return; eng.gain.value = VOL.engines / 80; fx.gain.value = VOL.effects / 80; alr.gain.value = VOL.alerts / 100 }
A.setVolumes = v => { for (const k in VOL) if (typeof v[k] == 'number') VOL[k] = Math.max(0, Math.min(100, v[k])); if (C) { set(master.gain, mv(), 0.05); mix() } };
/* told of every cue (the captions) */
A.onCue = null;
/* pausing holds the sound */
A.hold = on => { held = on; if (!C) return; try { on ? C.suspend() : C.resume() } catch (e) {} };

/* every frame: f = {main 0..1, rcs 0..1, speed 0..1 (of top speed), cruise 0..1 or 0, strain 0..1, conscious, docked} */
A.update = function (f) {
	if (!C || held || !L) return;
	const out = f.docked ? 0 : 1;
	set(L.drive.gain, out * (0.03 + 0.32 * f.main) * (f.engines === false ? 0 : 1));
	set(L.driveF.frequency, 160 + 420 * f.main + 300 * f.speed);
	L.saw.forEach((o, i) => set(o.frequency, (52 + 30 * f.speed + 14 * f.main) * (i ? 1.013 : 1), 0.2));
	set(L.rcs.gain, out * Math.min(0.22, 0.25 * f.rcs), 0.03);
	set(L.cruise.gain, out * (f.cruise > 0 ? 0.05 + 0.05 * f.cruise : 0), 0.3);
	L.cz.forEach((o, i) => set(o.frequency, [110, 110.6, 165][i] * (1 + 1.5 * f.cruise), 0.4));
	set(L.hum.gain, f.docked ? 0.02 : 0.012);
	/* g: muffle with strain; out cold, nearly silent */
	set(muffle.frequency, !f.conscious ? 180 : 18000 * Math.pow(0.04, Math.min(1, f.strain * 1.2)), 0.25);
	set(bus.gain, f.conscious ? 1 : 0.35, 0.4);
	/* a heartbeat once the strain is past halfway, faster as it climbs */
	if (f.strain > 0.5 || !f.conscious) {
		const now = C.currentTime, gap = !f.conscious ? 0.95 : 0.9 - 0.45 * (f.strain - 0.5) / 0.5;
		if (now > beatAt) { beatAt = now + gap; thump(now, 0.5); thump(now + 0.16, 0.35) }
	}
};
function thump(t, g) {
	const o = C.createOscillator(), a = C.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.14);
	a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + 0.01); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
	o.connect(a); a.connect(master); o.start(t); o.stop(t + 0.25);   /* straight to master: the heartbeat isn't muffled */
}
function tone(t, f, d, type, g, f2) {
	const o = C.createOscillator(), a = C.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
	a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + 0.008); a.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(a); a.connect(dest || bus); o.start(t); o.stop(t + d + 0.02);
}
function burst(t, d, g, type, f) {
	const s = C.createBufferSource(); s.buffer = noiseBuf; const x = filt(type || 'lowpass', f || 400); const a = C.createGain();
	a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(x); x.connect(a); a.connect(dest || bus); s.start(t, Math.random()); s.stop(t + d + 0.02);
}
const last = {};
A.cue = function (k, arg) {
	if (A.onCue) try { A.onCue(k) } catch (e) {}
	if (!A.on || !ctx() || held) return;
	dest = ALERTS.includes(k) ? alr : fx;
	const t = C.currentTime, now = performance.now();
	const gap = {collide: 250, warning: 400, critical: 400, tick: 60, pulse: 70, gatling: 45, driver: 120, heavy: 200, shieldHit: 90, hullHit: 120, boom: 150, lock: 600, incoming: 900}[k] || 0; if (gap && now - (last[k] || 0) < gap) return; last[k] = now;
	switch (k) {
	case 'warning': tone(t, 880, 0.14, 'square', 0.05); tone(t + 0.17, 660, 0.18, 'square', 0.05); break;
	case 'critical': for (let i = 0; i < 3; i++) tone(t + i * 0.11, 1250, 0.08, 'square', 0.06); break;
	case 'clearance': tone(t, 660, 0.12, 'sine', 0.08); tone(t + 0.13, 990, 0.2, 'sine', 0.08); break;
	case 'refused': tone(t, 300, 0.22, 'sawtooth', 0.05, 220); break;
	case 'docked': [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, f, 0.35, 'sine', 0.07)); break;
	case 'launch': burst(t, 1.2, 0.4, 'lowpass', 300); tone(t, 90, 1.0, 'sawtooth', 0.05, 140); break;
	case 'collide': burst(t, 0.45, Math.min(0.9, 0.25 + (arg || 0) / 60), 'lowpass', 260); tone(t, 120, 0.3, 'square', 0.05, 50); break;
	case 'charge': tone(t, 140, 3.0, 'sawtooth', 0.035, 560); break;
	case 'cruise': burst(t, 1.4, 0.35, 'bandpass', 900); tone(t, 220, 0.9, 'triangle', 0.06, 880); break;
	case 'drop': burst(t, 1.0, 0.4, 'lowpass', 500); tone(t, 700, 0.8, 'triangle', 0.06, 120); break;
	case 'emergency': burst(t, 1.3, 0.8, 'lowpass', 220); for (let i = 0; i < 3; i++) tone(t + 0.2 + i * 0.11, 1250, 0.08, 'square', 0.06); break;
	case 'faOn': tone(t, 520, 0.08, 'sine', 0.06); tone(t + 0.08, 780, 0.1, 'sine', 0.06); break;
	case 'faOff': tone(t, 780, 0.08, 'sine', 0.06); tone(t + 0.08, 520, 0.1, 'sine', 0.06); break;
	case 'tick': tone(t, 1600, 0.03, 'square', 0.03); break;
	case 'blackout': burst(t, 1.6, 0.3, 'lowpass', 120); break;
	case 'wake': tone(t, 300, 0.6, 'sine', 0.05, 600); break;
	case 'jump': burst(t, 2.6, 0.5, 'bandpass', 700); tone(t, 110, 2.4, 'sawtooth', 0.05, 1400); tone(t + 0.4, 220, 2.0, 'triangle', 0.05, 1800); break;
	case 'arrive': burst(t, 1.2, 0.45, 'lowpass', 600); tone(t, 900, 1.0, 'triangle', 0.06, 140); break;
	case 'destroyed': burst(t, 2.2, 1, 'lowpass', 180); tone(t, 80, 1.8, 'sawtooth', 0.08, 30); break;
	/* combat (M4): guns, hits, explosions at a distance (arg: 0..1 loudness), missile lock and warning */
	case 'pulse': tone(t, 1400, 0.07, 'square', 0.025, 500); break;
	case 'driver': burst(t, 0.12, 0.25, 'bandpass', 1200); tone(t, 260, 0.1, 'square', 0.03, 90); break;
	case 'gatling': burst(t, 0.03, 0.18, 'bandpass', 2200); break;
	case 'heavy': tone(t, 700, 0.25, 'sawtooth', 0.04, 160); break;
	case 'missile': burst(t, 0.9, 0.3, 'bandpass', 1600); tone(t, 400, 0.6, 'sawtooth', 0.025, 1200); break;
	case 'flare': burst(t, 0.3, 0.3, 'highpass', 2500); break;
	case 'shieldHit': tone(t, 300, 0.18, 'sine', 0.06, 900); burst(t, 0.15, 0.15, 'highpass', 1800); break;
	case 'hullHit': burst(t, 0.3, 0.6, 'lowpass', 300); tone(t, 90, 0.2, 'square', 0.05, 50); break;
	case 'boom': burst(t, 1.4, 0.2 + 0.6 * (arg == null ? 1 : arg), 'lowpass', 260); break;
	case 'lock': tone(t, 1800, 0.06, 'sine', 0.05); tone(t + 0.08, 1800, 0.06, 'sine', 0.05); tone(t + 0.16, 2400, 0.2, 'sine', 0.05); break;
	case 'chart': [880, 1175, 1568].forEach((f, i) => tone(t + i * 0.07, f, 0.12, 'sine', 0.045)); break;
	case 'hatch': burst(t, 0.6, 0.25, 'lowpass', 500); tone(t, 180, 0.5, 'square', 0.03, 120); break;
	case 'scoop': tone(t, 520, 0.08, 'triangle', 0.06); tone(t + 0.1, 780, 0.12, 'triangle', 0.06); burst(t, 0.3, 0.2, 'lowpass', 700); break;
	case 'incoming': for (let i = 0; i < 4; i++) tone(t + i * 0.09, 2100, 0.05, 'square', 0.05); break;
	}
};
})();

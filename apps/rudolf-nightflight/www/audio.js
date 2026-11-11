/* ===== Night Flight: sound effects and music, made here with Web Audio (no sound files). The tunes are original.
   Music is scheduled a little ahead on the audio clock; it is not part of the game's simulation. GPL-2.0-or-later. ===== */
(function () {
'use strict';
const A = window.NFAUDIO = {music: true, sfx: true};
let C = null, master, mus, fx, noiseBuf;
function ctx() {
	if (C) { if (C.state == 'suspended' && !A.held) C.resume().catch(() => {}); return C }
	try { C = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { return null }
	master = C.createGain(); master.gain.value = .55; master.connect(C.destination);
	const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(master);
	mus = C.createGain(); mus.gain.value = .32; mus.connect(comp);
	fx = C.createGain(); fx.gain.value = .55; fx.connect(comp);
	noiseBuf = C.createBuffer(1, C.sampleRate * .5, C.sampleRate); const d = noiseBuf.getChannelData(0); let s = 1; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1 }
	return C;
}
A.unlock = () => ctx();
/* pausing holds the music and effects */
A.hold = on => { A.held = on; if (!C) return; try { on ? C.suspend() : C.resume() } catch (e) {} };
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const NN = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
const note = s => { const m = /^([A-G])(#|b)?(\d)$/.exec(s); return m ? 12 * (+m[3] + 1) + NN[m[1]] + (m[2] == '#' ? 1 : m[2] == 'b' ? -1 : 0) : null };
function tone(dst, t, f, d, type, g, f2) {
	const o = C.createOscillator(), a = C.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
	a.gain.setValueAtTime(.0001, t); a.gain.linearRampToValueAtTime(g, t + .005); a.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(a); a.connect(dst); o.start(t); o.stop(t + d + .02);
}
function noise(dst, t, d, g, hp) {
	const s = C.createBufferSource(); s.buffer = noiseBuf; const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 6000; const a = C.createGain();
	a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f); f.connect(a); a.connect(dst); s.start(t); s.stop(t + d + .02);
}

/* ---------- effects ---------- */
const last = {};
A.sfx = function (k) {
	if (!A.sfx || !A.sfxOn || !ctx() || A.held) return;
	const t = C.currentTime, now = performance.now();
	const gap = {shot: 70, graze: 45, hit: 50, pop: 30}[k] || 0; if (gap && now - (last[k] || 0) < gap) return; last[k] = now;
	switch (k) {
	case 'shot': tone(fx, t, 880, .05, 'square', .025, 660); break;
	case 'hit': tone(fx, t, 300, .04, 'square', .03, 200); break;
	case 'pop': tone(fx, t, 520, .12, 'triangle', .12, 1040); noise(fx, t, .08, .05, 3000); break;
	case 'big': tone(fx, t, 180, .5, 'sawtooth', .12, 50); noise(fx, t, .5, .12, 400); break;
	case 'graze': tone(fx, t, 1800, .03, 'sine', .04); break;
	case 'item': tone(fx, t, 1320, .06, 'sine', .07, 1760); break;
	case 'power': [0, .06, .12].forEach((d, i) => tone(fx, t + d, midi(76 + i * 4), .12, 'triangle', .1)); break;
	case 'charge': tone(fx, t, 440, .25, 'sine', .08, 990); break;
	case 'beam': tone(fx, t, 220, .6, 'sawtooth', .1, 880); noise(fx, t, .5, .08, 1500); break;
	case 'bomb': tone(fx, t, 110, 1.1, 'sine', .2, 440); noise(fx, t, 1, .12, 800); [0, .1, .2, .3].forEach(d => tone(fx, t + d, midi(84 + d * 20), .3, 'triangle', .06)); break;
	case 'miss': tone(fx, t, 600, .6, 'square', .1, 80); noise(fx, t, .4, .1, 1200); break;
	case 'rescue': [72, 76, 79, 84].forEach((n, i) => tone(fx, t + i * .07, midi(n), .25, 'triangle', .11)); break;
	case 'life': [72, 76, 79, 84, 88].forEach((n, i) => tone(fx, t + i * .09, midi(n), .3, 'square', .06)); break;
	case 'warn': [0, .35, .7].forEach(d => { tone(fx, t + d, 330, .28, 'square', .07); tone(fx, t + d, 311, .28, 'square', .05) }); break;
	case 'phase': tone(fx, t, 990, .3, 'triangle', .1, 495); break;
	case 'select': tone(fx, t, 880, .07, 'square', .04); break;
	case 'ok': tone(fx, t, 660, .08, 'square', .04); tone(fx, t + .07, 990, .1, 'square', .04); break;
	}
};

/* ---------- music ---------- */
/* each song: tempo, and lines of eighth notes ('-' holds, '.' rests); bass in quarter notes; drums k (kick) h (hat) s (snare) */
const SONGS = {
	title: {bpm: 96, lead: 'E5 - G5 A5 G5 - E5 - D5 - E5 G5 C5 - - - E5 - G5 A5 C6 - B5 A5 G5 - - - - - . . A5 - C6 D6 C6 - A5 - G5 - A5 G5 E5 - D5 - C5 - D5 E5 G5 - E5 - C5 - - - - - . .', bass: 'C3 G3 C3 G3 A2 E3 A2 E3 F2 C3 F2 C3 G2 D3 G2 B2 A2 E3 A2 E3 F2 C3 G2 D3 C3 G3 F2 G2 C3 G3 C3 .', drums: 'k . h . . . h . k . h . . . h .', wave: 'triangle'},
	s1: {bpm: 132, lead: 'C5 E5 G5 E5 A5 G5 E5 D5 C5 E5 G5 C6 B5 - G5 - A5 C6 B5 A5 G5 E5 D5 E5 F5 E5 D5 C5 D5 - . . E5 G5 C6 G5 A5 G5 E5 G5 F5 A5 G5 F5 E5 - C5 - D5 F5 E5 D5 C5 D5 E5 G5 C5 - - - . . . .', bass: 'C3 C3 G2 G2 A2 A2 E2 E2 F2 F2 C3 C3 G2 G2 G2 G2 C3 C3 E2 E2 F2 F2 C3 C3 D3 D3 G2 G2 C3 C3 C3 .', drums: 'k . h . s . h . k . h k s . h h', wave: 'square'},
	s2: {bpm: 140, lead: 'A4 C5 E5 A5 G5 E5 D5 E5 F5 E5 D5 C5 B4 - E5 - A4 C5 E5 A5 B5 A5 G5 E5 F5 G5 A5 G5 E5 - - . D5 F5 A5 F5 E5 G5 C6 G5 F5 E5 D5 C5 B4 C5 D5 E5 A4 C5 E5 G5 F5 E5 D5 B4 A4 - - - . . . .', bass: 'A2 A2 E3 E3 F2 F2 E2 E2 A2 A2 E3 E3 F2 G2 A2 . D3 D3 A2 A2 C3 C3 G2 G2 F2 F2 E2 E2 A2 A2 A2 .', drums: 'k . h . s . h h k k h . s . h .', wave: 'square'},
	boss: {bpm: 152, lead: 'E5 - E5 F5 E5 - B4 - C5 - D5 C5 B4 - A4 - E5 - E5 G5 F5 - E5 - D5 - C5 D5 E5 - - - A5 - G5 F5 E5 - D5 - C5 - B4 C5 D5 - E5 - F5 E5 D5 C5 B4 - G#4 - A4 - - - . . . .', bass: 'A2 A2 A2 A2 F2 F2 G2 G2 A2 A2 A2 A2 F2 F2 E2 E2 D3 D3 D3 D3 C3 C3 G2 G2 F2 F2 E2 E2 A2 A2 E2 E2', drums: 'k h s h k k s h k h s h k k s s', wave: 'sawtooth'},
	clear: {bpm: 120, lead: 'C5 E5 G5 C6 - - B5 C6 D6 - - - C6 - - - . . . . . . . .', bass: 'C3 G2 C3 . G2 G2 C3 . C3 . . .', drums: 'k . . . . . . . k . s . k . . .', wave: 'triangle', once: true}};
let song = null, step = 0, nextT = 0, timer = 0;
const tok = s => s.trim().split(/\s+/);
A.play = function (name) {
	if (song && song.name == name) return;
	A.stop(); if (!A.musicOn || !ctx()) { song = {name, quiet: true}; return }
	const S = SONGS[name]; if (!S) return;
	song = {name, S, lead: tok(S.lead), bass: tok(S.bass), drums: tok(S.drums)}; step = 0; nextT = C.currentTime + .08;
	timer = setInterval(sched, 60); sched();
};
A.stop = () => { clearInterval(timer); timer = 0; song = null };
A.setMusic = on => { A.musicOn = on; const n = song && song.name; if (!on) A.stop(); else if (n) { song = null; A.play(n) } };
function sched() {
	if (!song || !song.S || A.held) return;
	const e = 60 / song.S.bpm / 2;
	while (nextT < C.currentTime + .25) {
		const L = song.lead, i = step % L.length;
		if (song.S.once && step >= L.length) { A.stop(); return }
		const n = note(L[i]);
		if (n) { let len = 1; while (L[(i + len) % L.length] == '-' && len < 8) len++; tone(mus, nextT, midi(n), e * len * .95, song.S.wave, song.S.wave == 'square' ? .05 : song.S.wave == 'sawtooth' ? .035 : .09); tone(mus, nextT, midi(n + 12), e * len * .5, 'sine', .015) }
		if (step % 2 == 0) { const b = note(song.bass[(step / 2) % song.bass.length]); if (b) tone(mus, nextT, midi(b), e * 1.8, 'triangle', .12) }
		const d = song.drums[step % song.drums.length];
		if (d == 'k') tone(mus, nextT, 150, .12, 'sine', .25, 45); else if (d == 'h') noise(mus, nextT, .03, .05); else if (d == 's') noise(mus, nextT, .1, .1, 1500);
		nextT += e; step++;
	}
}
A.sfxOn = true; A.musicOn = true;
})();

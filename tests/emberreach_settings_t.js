/* Ember Reach's settings (settings.js) and languages (i18n.js), in node.
     node tests/emberreach_settings_t.js */
const path = require('path'), fs = require('fs');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const St = require(path.join(DIR, 'settings.js')), I = require(path.join(DIR, 'i18n.js')), Sv = require(path.join(DIR, 'save.js')), Tr = require(path.join(DIR, 'trade.js')), F = require(path.join(DIR, 'factions.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d) : '')) } };
try {
	/* the languages: Rudolf OS's own list */
	const OS = [['en', 'English', 'en-US'], ['es', 'Español (Spanish)', 'es-ES'], ['pt', 'Português (Portuguese)', 'pt-BR'], ['fr', 'Français (French)', 'fr-FR'], ['de', 'Deutsch (German)', 'de-DE'], ['ru', 'Русский (Russian)', 'ru-RU'], ['zh', '中文 (Chinese)', 'zh-CN'], ['ja', '日本語 (Japanese)', 'ja-JP'], ['ko', '한국어 (Korean)', 'ko-KR']];
	ok('1. the languages are the ones Rudolf OS offers in its settings, with its names and locales', JSON.stringify(I.LANGS) == JSON.stringify(OS));
	ok('2. every language has every string (and no blanks)', Object.keys(I.TR).length == 8 && Object.values(I.TR).every(l => l.length == I.EN.length && l.every(x => typeof x == 'string' && x.trim())));
	I.setLang('de'); const de = I.T('Settings'); I.setLang('ja'); const ja = I.T('Landing gear'); I.setLang('xx'); const back = I.lang();
	ok('3. T() gives the chosen language, English for anything untranslated, and an unknown language falls back to English', de == 'Einstellungen' && ja == '着陸脚' && back == 'en' && I.T('Unlisted string') == 'Unlisted string');
	I.setLang('fr');
	ok('4. holes are filled: "Taken from {a}"', I.T('Taken from {a}', {a: 'Tirer'}) == 'Retirée de Tirer');
	I.setLang('en');
	ok('5. a new pilot starts in the browser\'s language if Rudolf OS offers it, else English', I.guess('pt-BR') == 'pt' && I.guess('ko') == 'ko' && I.guess('it-IT') == 'en' && I.guess('') == 'en');
	/* every string the game asks for is in the list */
	const src = ['play.js', 'hud.js', 'settings.js'].map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
	const asked = new Set([...src.matchAll(/\b(?:tr|TT|T)\('([^']+)'/g)].map(m => m[1]));
	for (const v of Object.values(St.ACTION)) asked.add(v); for (const [g] of St.GROUPS) asked.add(g);
	const PLAY = fs.readFileSync(path.join(DIR, 'play.js'), 'utf8'), cap = /const CAPTION = \{([\s\S]*?)\};/.exec(PLAY)[1];
	for (const m of cap.matchAll(/'([^']+)'/g)) asked.add(m[1]);
	/* (what's asked: anything that starts with a capital, as every string shown does; not ids like 'high' or 'audio.on') */
	const missing = [...asked].filter(x => /^[A-Z]/.test(x) && !I.EN.includes(x));
	ok('6. every menu, HUD, control and caption string the game asks for has its translations', !missing.length, missing);
	/* settings */
	const D = St.DEFAULTS(), acts = Object.keys(St.ACTION);
	ok('7. defaults: high quality, full resolution, 70° view, sound on, HUD at 100%, three messages for 8 s, flashing as Rudolf OS says', D.graphics.quality == 'high' && D.graphics.res == 100 && D.graphics.fov == 70 && D.audio.on && D.hud.size == 100 && D.hud.messages == 3 && D.hud.msgTime == 8 && D.a11y.flash == 'os');
	const bad = St.sanitise({graphics: {quality: 'ultra', res: 5, fov: 400, glow: 'yes'}, audio: {master: -3, effects: 250}, hud: {size: 900, messages: 50}, controls: {keys: {fire: ['KeyF', 42, '<script>'], bogus: ['KeyA']}, deadzone: 99}, lang: 'tlh', a11y: {palette: 'neon', flash: 'maybe'}}, acts, I.LANGS.map(l => l[0]));
	ok('8. anything out of range or unknown is clamped or dropped (a hand-edited save can\'t break it)', bad.graphics.quality == 'high' && bad.graphics.res == 50 && bad.graphics.fov == 100 && bad.graphics.glow === true && bad.audio.master == 0 && bad.audio.effects == 100 && bad.hud.size == 150 && bad.hud.messages == 8
		&& JSON.stringify(bad.controls.keys) == '{"fire":["KeyF"]}' && bad.controls.deadzone == 40 && bad.lang == 'en' && bad.a11y.palette == 'off' && bad.a11y.flash == 'os', bad);
	const old = St.sanitise({quality: 'low', sound: false});
	ok('9. older saves\' settings carry over (quality, sound)', old.graphics.quality == 'low' && old.audio.on === false);
	/* keys */
	const KEYS = {fire: ['Semicolon', 'pad:7'], gear: ['KeyL'], fa: ['KeyZ', 'pad:1'], missile: ['KeyK', 'pad:6']};
	const S = St.DEFAULTS();
	ok('10. the gear is on L and fire on ; by default (the game\'s own map)', /gear: \['KeyL'\]/.test(PLAY) && /fire: \['Semicolon', 'pad:7'\]/.test(PLAY));
	let took = St.rebind(KEYS, S, 'fire', 1, 'KeyL'), B = St.bindings(KEYS, S);
	ok('11. binding a key that\'s taken moves it, and says from which action', took.join() == 'gear' && B.fire.join() == 'Semicolon,KeyL,pad:7' && B.gear.length == 0);
	St.rebind(KEYS, S, 'missile', 2, 'pad:7'); B = St.bindings(KEYS, S);
	ok('12. gamepad buttons rebind the same way (one per action)', B.missile.join() == 'KeyK,pad:7' && !B.fire.includes('pad:7'));
	St.rebind(KEYS, S, 'fa', 0, null); B = St.bindings(KEYS, S);
	ok('13. a key can be unbound', B.fa.join() == 'pad:1');
	ok('14. the changes are only the player\'s: the defaults are untouched', KEYS.fire.join() == 'Semicolon,pad:7' && KEYS.gear.join() == 'KeyL');
	ok('15. keys read as people know them', ['KeyL', 'Semicolon', 'ArrowUp', 'ShiftLeft', 'Digit1', 'pad:7', 'pad:12', 'NumpadAdd'].map(St.keyName).join('|') == 'L|;|↑|L Shift|1|🎮 RT|🎮 D-pad ↑|Num +');
	/* through the save */
	const g = {power: 1, ship: 'wren', day: 200, t: 5, docked: false, s: {p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0], fa: true}, throttle: 0, fit: {modules: [{id: 'power', hp: 1}]}, settings: Object.assign(S, {lang: 'ko'}), star: {id: 'abc', x: 1, y: 2, z: 3}, fuel: 1, player: Tr.newPlayer(F.majors()[0].id)};
	const round = Sv.unpack(JSON.parse(JSON.stringify(Sv.pack(g))), {});
	ok('16. the save keeps the settings: keys, language, everything', round && round.settings.lang == 'ko' && round.settings.controls.keys.fire.join() == 'Semicolon,KeyL' && round.settings.controls.keys.missile.join() == 'KeyK,pad:7');
	const keep = Sv.unpack({settingsOnly: true, settings: {lang: 'ja', hud: {size: 125}}}, {});
	ok('17. a new game keeps them (the save holds only the settings until the first real one)', keep && !keep.ship && keep.settings.lang == 'ja' && keep.settings.hud.size == 125);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);

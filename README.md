# Rudolf OS Library

Apps made for [Rudolf OS](https://github.com/merciless146/RudolfOS) that not every computer needs. They are kept out of
the system and installed from the App Store's **Rudolf OS Library** tab. It works like Flathub, for Rudolf OS's own apps.

Published at **https://merciless146.github.io/rudolfos-library/**:
- `index.txt` and `index.sig`: the signed package list rpk reads;
- `<name>.rpk`: the packages;
- `catalog.json`: titles, icons, descriptions and sizes, for the App Store;
- `source/`: the source of compiled programs;
- `keys.txt`: the Library's public key.

## Apps

| | Package | What it is | Licence |
|---|---|---|---|
| 🎯 | `rudolf-quake` | Quake's engine with the free LibreQuake game data (and the engine's source) | GPL-2.0-or-later, BSD-3-Clause |
| 🌙 | `rudolf-nightflight` | Night Flight: Rudolf's bullet-hell flight (stages 1-2 and their bosses so far), replays | GPL-2.0-or-later |
| 🧱 | `rudolf-blockdrop` | Block Drop: a falling-blocks puzzle with prisms that burst a whole colour and set off chains; Classic, Relaxed and Daily | GPL-2.0-or-later |
| ⛏️ | `rudolf-faultlines` | Fault Lines: a logic puzzle (clear the ground without opening a fault), with a Daily field | GPL-2.0-or-later |
| 🕹️ | `rudolf-emu` | Emu's Nintendo DS (DeSmuME) and SNES (LakeSnes) cores, as WebAssembly. No games, BIOS files or keys | GPL-2.0-or-later, MIT |

## Layout

```
apps/<name>/PKGINFO     name, version, kind, title, summary, description, icon, category, license, homepage
apps/<name>/www/        the files, served by Rudolf OS at /pkg/<name>/www/
apps/<name>/source/     (programs built from source) the corresponding source, published as source/<name>-<version>-src.tar.xz
lib/gamekit/            rudolf-gamekit: input, window shapes, saves and pausing shared by the games; copied into each
                        game whose index.html loads gamekit.js when the Library is built
tests/                  each game's browser test (Chromium, in a sandboxed frame as the desktop opens it)
tools/                  rpk-tool.py (from RudolfOS iso/pkgtools), publish.sh, catalog.py, keycheck.py
site/                   the Library's web page
.github/workflows/publish.yml   builds, signs and publishes on every change to main
.github/workflows/check.yml     runs the games' tests on pull requests
```

## Games

Rudolf OS's own games (the plan: `docs/plan-games.md` in RudolfOS) are `webapp` packages. Each loads `gamekit.js`
(`lib/gamekit`), which gives it keyboard, mouse, touch and controller input as one set of actions, a canvas that fits any
window shape (phones upright included, for Rudolf OS 1.6.0), saves kept by the desktop with export and import as a file,
and pausing when the window is hidden or the computer locks. The desktop opens a game in a sandboxed frame and answers
the kit's messages (`{rudolfGame: 1, op: 'hello' | 'load' | 'save'}`; it sends `pause`, `resume` and `settings`).
Test a game with `node tests/<game>_t.js` (Playwright).

Packages are read-only squashfs images with an Ed25519 signature (`rpk1 ` + the SHA-256 of the image). They are
reproducible: an app that did not change gives the same bytes, so computers do not download it again.

## Publishing a new version

1. Change the app's files and raise `version` in its `PKGINFO`.
2. Merge to main. The **Publish the Library** workflow builds, signs and publishes. Computers see the update in the
   App Store's Updates.

## Keys

The Library has its **own** key. Rudolf OS trusts it for apps only (`/etc/rudolf/library-keys`), never for system
updates. A stolen Library key could not change the operating system.
- The public key is in `keys.txt`.
- The private key is only in this repository's secret `RPK_LIBRARY_KEY`, and offline with the owner.
- The workflow checks that the secret matches `keys.txt` before it signs anything.

Never commit a private key (`*.pem`, `*.key`).

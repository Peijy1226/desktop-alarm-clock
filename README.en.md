# Desktop Alarm Clock

[![release](https://img.shields.io/github/v/release/Peijy1226/desktop-alarm-clock?cacheSeconds=3600)](https://github.com/Peijy1226/desktop-alarm-clock/releases)
[![license](https://img.shields.io/github/license/Peijy1226/desktop-alarm-clock)](LICENSE)

[中文](README.md) · **English**

A Windows alarm clock that never touches the network. Close the window and it stays in the tray; when an alarm fires it comes out on its own.

**[Try it online →](https://peijy1226.github.io/desktop-alarm-clock/)** nothing to install, runs in the browser

![Demo](docs/demo.gif)

## Install

Two exe files in [Releases](https://github.com/Peijy1226/desktop-alarm-clock/releases), just double-click:

`-setup.exe` installs with Start menu and desktop shortcuts; `-portable.exe` is no-install and runs from a USB stick too.

Both are single files. No Node.js, no runtime libraries. It's 76MB, almost all of that being Electron itself.

If you'd rather not install anything, the [web version](https://peijy1226.github.io/desktop-alarm-clock/) opens and runs, or download `index.html` from the repo and double-click that.

## Why this exists

I wanted to know how long until I could sleep without lighting up the room. Checking a laptop screen at 2am is blinding, and reaching for my phone wakes me up completely. I just wanted a pure black screen with nothing but digits.

So the blackout countdown got the most attention, and everything else grew around it.

Full screen, pure black, red digits, one more dim step after 12 seconds of no input — dim enough to read, not enough to light the room. The digits scale down with screen width so no typeface gets clipped on the right. Click the top-left corner to switch typefaces in place. `Esc` goes back, and the window returns to exactly its previous size.

## Typefaces

Nine of them. There was only one at first; it kept growing.

Modern sans, sci-fi HUD, terminal mono, thin minimalist, classic serif, handwriting, heavy display, plus two that aren't fonts at all — seven-segment and dot-matrix, drawn as SVG, identical on every machine.

The annoyance is that switching typefaces makes the digits change size. Different fonts draw numerals at completely different heights — Impact sits low, seven-segment fills the whole em box. Same font size, visually almost double.

The fix was to render each typeface to a canvas, scan it row by row to find the actual pixel height, and back-calculate the font size from that. All nine now land within 2 pixels of each other, which the eye can't catch.

`measureText().actualBoundingBoxAscent` is useless for this. For handwriting fonts it was off by a third.

## Chimes

17 built in, all synthesized live with Web Audio — oscillators and envelopes, not a single audio file in the program. That keeps the install small and makes switching instant.

They're grouped into five categories: classic, punchy, fresh, gentle, and other. Bright ones are bright, muffled ones are muffled — all tuned by hand.

You can also use your own music, **up to 100MB per file** — a full lossless track fits. MP3, WAV, FLAC, AAC, M4A, OGG and OPUS all work. Audio is stored as-is, no transcoding or compression. A 95MB WAV lands in about a second and plays without stutter.

Uploads get verified for decodability right away, so an alarm never rings silent.

## Alarms

Six repeat modes: once, daily, a specific date, weekdays, Chinese public holidays, or any set of weekdays.

A repeating alarm you don't want tomorrow can be skipped just once, without turning it off and back on.

Time down to the second, with labels, 5-minute snooze, and ring duration (forever, 10s, 30s, 1m, 5m, 10m).

Optional hourly chime: pick any of the 24 hours, with its own volume.

## What the desktop build adds

**Closing the window doesn't quit.** It goes to the tray and alarms still fire. The web version needs the tab open, which is a big difference.

**Starts with Windows.** Tick it once and forget it.

**Blocks sleep while alarms are pending.** This one matters — a laptop that sleeps won't wake you.

**Forces itself to the front** when an alarm fires, plus taskbar flash and a system notification. It interrupts you mid-typing, which is what an alarm should do.

Data stays in `%APPDATA%`, nothing leaves the machine. Uninstalling doesn't delete it, so a reinstall keeps your alarms.

## GPU acceleration is off

NVIDIA, Steam and Discord draw their FPS overlays by injecting into the GPU pipeline. No amount of window stacking covers them — they're not windows.

So the app doesn't create a GPU surface at all. Nothing to inject into, nothing to draw over. The UI composites on the CPU instead.

Measured: about 1.7% of one core with the window open, ~2% minimized, around 400MB of memory. That memory figure is Electron's floor and has nothing to do with this setting. No fan spin, no noticeable battery drain.

## Build it yourself

```bash
cd desktop
npm install
npm start
```

To package (PowerShell):

```powershell
cd desktop
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win nsis portable --x64
```

Output lands in `desktop/release/`.

## Code layout

```
index.html            the entire web version, single file
desktop/main.js       Electron main process: window, tray, notifications, power
desktop/preload.js    the narrow API exposed to the renderer
desktop/app/          desktop page (generated, don't edit)
desktop/build/        icon generation + web-to-desktop conversion
```

Only edit the root `index.html`. After changing it, sync:

```bash
cd desktop && python build/make_desktop_app.py
```

The script does four things: applies the custom title bar, removes the browser audio prompt, reports ring events to the main process, and injects the desktop settings panel.

Notes on problems hit along the way are in [NOTES.md](NOTES.md) — fullscreen sizing, SVG fills, font measurement, and large-file storage are the ones that keep coming back.

## License

MIT

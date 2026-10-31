# Portrait

A bridgething webapp for using the Car Thing standing on its side: a vertical now-playing
screen with synced lyrics.

The Car Thing's screen is a fixed 800x480 landscape panel and bridgething has no system-wide
rotation, so Portrait lays out a 480x800 page and rotates it 90° in CSS. Touch still lands in
the right place because the browser hit-tests through the transform.

## Controls

| Control                 | Does                                                  |
| ----------------------- | ----------------------------------------------------- |
| Dial turn               | Volume (or scrub / skip, set in the companion app)    |
| Dial click              | Play / pause                                          |
| Back (tap)              | Toggle the lyrics view                                |
| Back (hold ~1 s)        | Flip orientation (dial at top ↔ dial at bottom)       |
| Preset 1 / 2 / 3 / 4    | Previous / play-pause / next / like                   |
| M                       | Untouched, so your launcher gesture still works       |
| Touch                   | All on-screen buttons, drag the progress bar, tap the artwork for lyrics, tap a lyric line to jump to it |

## Settings (companion app → Portrait → settings)

- **Orientation**: dial at the top or the bottom. A flip done with the back button is remembered on
  the device until you change this setting again.
- **Dial turns**: volume, scrub through the track (5 s per click), or skip tracks.
- **Reverse dial direction**: if clockwise feels backwards.

## Install

**Quickest:** send `Portrait-0.1.0.zip` to your phone and install it from the bridgething
companion app.

**From source**, with the Car Thing plugged into your computer over USB:

```sh
bun install
bun run --cwd apps/portrait push        # build and install onto the device, then switch to it
bun run --cwd apps/portrait dev:device  # or: live hot-reload on the device's screen
```

## Preview without a device

```sh
bun run --cwd apps/portrait build && bunx --cwd apps/portrait vite preview
```

Open `http://localhost:4173/?demo` with the window set to 800x480 (DevTools device toolbar).
Use `?demo&rotation=dial-bottom` for the other orientation. Shift+scroll is the dial, `1`-`4`
are presets, `Enter` is the dial click, `Escape` is back.

## Notes

- Portrait draws its own vertical volume indicator (`overlays.volume: false` in the manifest).
  Other system overlays (notifications, calls, pairing) are still drawn by bridgething in
  landscape.
- Other apps stay landscape. Portrait only rotates itself.

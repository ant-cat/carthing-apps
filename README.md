# carthing-apps

Webapps I build for the Spotify Car Thing running [bridgething](https://bridgething.com). Install them from the
bridgething store in the companion app, or add this source there by pasting
`https://raw.githubusercontent.com/ant-cat/carthing-apps/gh-pages/catalog.v1.json`.

- **Portrait**: a vertical now-playing screen with synced lyrics, for a Car Thing standing on its side.
- **Claude Usage Portrait**: Claude Code limits, token history and live sessions on a vertical screen. A portrait
  fork of Joey Eamigh's Claude Usage.

## First run

1. Push this repo to `https://github.com/ant-cat/carthing-apps`.
2. In **Settings > Pages**, set the source to **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.

The catalog is published to `https://ant-cat.github.io/carthing-apps/catalog.v1.json`. Once it loads, `bun run submit` lists it in the [bridgething store](https://bridgething.com/apps).

## Develop

```sh
bun run dev            # develop the app against a connected bridgething instance
bun run dev:device     # show the dev server on the car thing screen
bun run push           # build and install to the device
bun run check          # ensure the catalog is valid
```

With more than one app in `apps/` your commands must specify which one: `bun run dev portrait`.

Screenshot for the store listing:

```sh
bun run shot portrait            # grabs what is on the screen
bun run shot portrait --replace  # overwrite
```

## Add another app

```sh
bun run new weather                 # a webapp
bun run new dashboard --extension   # a webapp plus a desktop-side Deno process
bun run new home --launcher         # a replacement home screen
bun run new hud --overlay           # a system overlay drawn over every webapp
```

## Ship

```sh
bun run bump portrait patch -m "Fix the wind direction arrow"
git commit -am "portrait: fix the wind direction arrow" && git push
```

Pushing to main builds the apps and regenerates the catalog. The store rechecks listed sources on its own; `bun run submit` refreshes right away.

## Agent skill

`.claude/skills/bridgething/` holds the `/bridgething` skill.

```sh
bun run skills           # refresh it from the published create-bridgething
bun run skills --check   # check whether it, the toolkit, or the scripts it uses are behind
```

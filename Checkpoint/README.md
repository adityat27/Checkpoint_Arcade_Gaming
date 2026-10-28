# CHECKPOINT!! arcade

A static site with no build step. Upload the whole folder (`index.html`, `css/`, `js/`) to Vercel or any static host and it works. To try it locally, open `index.html` in a browser, or run `npx serve .` in this folder.

## Where things live

```
index.html              the page: hub cards, lobby, overlays, and the list of scripts (load order matters)
css/
  base.css              shared look: colours, buttons, cards, hub, menus, results overlay, phone layout
  brawl.css             one stylesheet per game
  glaze.css  overdrive.css  cipher.css  hang.css  rps.css
  boardroom.css  airhockey.css  orderup.css  deadweight.css
js/core/                shared systems (loaded first)
  utils.js              $, wait, rng, esc, TOUCH_UI, need3D() / needNet() library loaders
  audio.js              music themes (THEMES) + sound effects (SFX.name())
  state.js              shared game state (player, rival, room, phase…)
  ui.js                 screens: show(), regGame() plug-in registry, setOver() results overlay, rematch
  net.js                online play: MQTT rooms + WebRTC direct link (NET.ev / NET.sendFast), join(), leave()
  art.js                hub card + menu banner pictures (ART_GEN / ART_SVG helpers)
  main.js               hub wiring: profile, card clicks, invite links, sound buttons
js/games/               one file (or folder) per game
  brawl.js              Brawl
  glaze.js              Glaze Craze
  overdrive/cars.js     Overdrive: the 5 car models
  overdrive/race.js     Overdrive: tracks, driving physics, online racing
  cipher.js             Cipher Sync
  hang.js               Hang Tight
  rps.js                Rock Paper Scissors
  boardroom.js          Board Room (bluffing auction)
  airhockey.js          Air Hockey
  orderup.js            Order Up! (3D co-op kitchen)
  deadweight/core.js    Deadweight: course layout + climbing/rope physics (no drawing)
  deadweight/game.js    Deadweight: 3D world, HUD, controls, online sync
```

Each game file starts with its menu and game-screen HTML, then the game code, then its music theme and card art at the bottom.

## Load order

`index.html` loads scripts in this order: core (utils → audio → state → ui → net → art) → the older games → `main.js` → the newer plug-in games. They are classic scripts that share one global scope, so a file can only use what was loaded before it, at the moment it runs.

## Common edits

| I want to… | Edit |
|---|---|
| Change colours, fonts or buttons everywhere | `css/base.css` (`:root` variables at the top) |
| Change Overdrive car handling | `OVT` near the top of the physics section in `js/games/overdrive/race.js` |
| Change Air Hockey speed or bounce | `PH` at the top of `js/games/airhockey.js` |
| Change Board Room deals, scandals or names | `LOTS` at the top of `js/games/boardroom.js` |
| Change the Deadweight course | `COURSE` in `js/games/deadweight/core.js` (boxes, checkpoints, signs) |
| Change Deadweight jump, rope length or gravity | `CFG` in `js/games/deadweight/core.js` |
| Change a game's music | `THEMES.<game>` at the bottom of that game's file |
| Change a hub card picture | `ART_GEN.<game>` at the bottom of that game's file |
| Change the online servers | `BR` (broker list) at the top of `js/core/net.js` |

## Adding a new game

1. Create `js/games/mygame.js` and `css/mygame.css`, then add both to `index.html` (the script goes after `main.js`).
2. In the script, call `mountScreens(html)` with a menu `<section>` and a game `<section>` (both `hidden`).
3. Add a hub card in `index.html`: `<button class="gc" data-g="mygame">…</button>`.
4. Register it:
   ```js
   regGame('mygame',{name:'My Game',menu:'mymenu',stage:'mygame-stage',cd:'#cdX',theme:'mygame',
     start(mode){…}, sync(){…}, event(d){…}, fast(d){…}, rematch(){…}, stop(){…}, hb:()=>({…})});
   ```
   - `start('cpu' | 'local' | 'online')`: begin a match.
   - `sync()`: the rival joined, left or sent a heartbeat (`opp.x` is their `hb()` data).
   - `event(d)`: a reliable message from the rival, sent with `NET.ev({e:'…',…})`. Don't use a field named `id`.
   - `fast(d)`: a high-rate snapshot, sent with `NET.sendFast({f:1,…})`.
   - `hb()`: small state that is re-sent every 1.2 s, so a player who missed something can catch up.

## Handy URL switches

- `?flat`: Order Up! uses its 2D renderer instead of 3D (useful on very old phones).
- `#game/CODE`: an invite link. It opens that game with the room code filled in.

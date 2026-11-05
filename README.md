# CHECKPOINT!! arcade

A static site with no build step. Upload the whole folder (`index.html`, `css/`, `js/`, `img/`) to Vercel or any static host and it works. To try it locally, open `index.html` in a browser, or run `npx serve .` in this folder.

## Where things live

```
index.html              the page: top bar + animated logo, hub skeleton, profile sheet, lobby, results popup, and the list of scripts (load order matters)
img/cards/              each game's card picture (<id>.webp, tall) and featured/menu banner (<id>-wide.webp): poster art made from each game's own 3D models and drawings
css/
  base.css              shared pieces on the game screens: .card panels, .btn buttons, inputs, room-code box (Inter / Space Grotesk)
  hub.css               the modern shell: top bar, logo animation, hub, holo cards, card-open animation, profile, game menus, lobby, results popup
  brawl.css             one stylesheet per game
  glaze.css  overdrive.css  cipher.css  hang.css  rps.css
  boardroom.css  airhockey.css  orderup.css  deadweight.css  slipstream.css  maze.css
js/core/                shared systems (loaded first)
  utils.js              $, wait, rng, esc, TOUCH_UI, need3D() / needNet() library loaders
  audio.js              music themes (THEMES) + sound effects (SFX.name())
  state.js              shared game state (player, rival, room, phase…)
  ui.js                 screens: show(), regGame() plug-in registry, setOver() results overlay, rematch
  net.js                online play: MQTT rooms + WebRTC direct link (NET.ev / NET.sendFast), join(), leave()
  art.js                the older drawn card pictures (ART_GEN / ART_SVG helpers); the hub now uses img/cards
  main.js               profile (name, avatar), invite links, sound buttons
  hub.js                the hub: game list (names, genres, colours, rarity), featured game, holo card tilt (mouse, finger, phone), filters, the card-swivel opening animation, menu banners. Loaded last
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
  deadweight/core.js    Deadweight: maps, the random course generator, climbing/rope physics, the solo bot (no drawing)
  deadweight/game.js    Deadweight: themed 3D worlds, HUD, controls, online sync
  slipstream/core.js    Slipstream: the endless road, lane traffic, driving physics, scoring, test bot (no drawing)
  slipstream/cars.js    Slipstream: the car, bus and truck models, built in code from body cross-sections
  slipstream/game.js    Slipstream: 3D roads (coast / ridge / night), camera, HUD, touch pads, engine sound, online race
  maze.js               Maze Munch: random symmetric mazes, monsters, fruit, bots, five modes (solo, co-op, versus, hunter, free-for-all), online
```

Each game file starts with its menu and game-screen HTML, then the game code, then its music theme and card art at the bottom.

## Load order

`index.html` loads scripts in this order: core (utils → audio → state → ui → net → art) → the older games → `main.js` → the newer plug-in games. They are classic scripts that share one global scope, so a file can only use what was loaded before it, at the moment it runs.

## Common edits

| I want to… | Edit |
|---|---|
| Change the hub's colours, fonts or card look | `css/hub.css` (`:root` variables at the top) |
| Change a game's card text, colour, rarity or filter tags | `INFO` at the top of `js/core/hub.js` |
| Change a card or banner picture | replace `img/cards/<id>.webp` (600×840) or `img/cards/<id>-wide.webp` (1600×640) |
| Change the colours, buttons or panels used inside games | `css/base.css` (`:root` variables at the top) |
| Change Maze Munch points, speeds or monster difficulty | `PTS`, `DIFF` and `runSpeed` / `monSpeed` in `js/games/maze.js` |
| Change the maze shape rules | `buildMaze()` in `js/games/maze.js` |
| Change Overdrive car handling | `OVT` near the top of the physics section in `js/games/overdrive/race.js` |
| Change Air Hockey speed or bounce | `PH` at the top of `js/games/airhockey.js` (also: how a puck pinned on a rail squirts out, and the anti-stuck timer) |
| Change Board Room deals, scandals or names | `LOTS` (and `FLAVOR` for the card text) at the top of `js/games/boardroom.js` |
| Add an Order Up! dish | `ING` (ingredients), `SOUPS` (pot mixes) and `RECIPES` near the top of `js/games/orderup.js` |
| Add an Order Up! kitchen | `LEVELS` in `js/games/orderup.js` (each kitchen is a little text map; the key is in the comment above it) |
| Add a Deadweight mountain | `MAPS` in `js/games/deadweight/core.js` (which obstacles it uses, how many, how hard) plus a look in `DW_THEMES` in `game.js` |
| Add a Deadweight obstacle | a method on `Builder` in `js/games/deadweight/core.js` (it adds boxes and ends with `this.rest(...)`), then list it in a map's `pool` |
| Change The Classic Deadweight route | `classicCourse()` in `js/games/deadweight/core.js` |
| Change Deadweight jump, rope length or gravity | `CFG` in `js/games/deadweight/core.js` |
| Change Slipstream traffic speed, density or near-miss distance | `CFG` at the top of `js/games/slipstream/core.js` (`laneV` lane speeds, `rampDist` how fast it gets busy, `nearGap`); car gaps and bus/truck odds are in `Traffic.grow()` |
| Change a Slipstream car's speed or handling | `STYLES` in `js/games/slipstream/core.js` |
| Reshape a Slipstream car, bus or truck | `SHAPES` in `js/games/slipstream/cars.js` (each row is one cross-section: position, widths, sill, shoulder line, roof) |
| Add a Slipstream road (look) | `ROUTES` + `LOOK` at the top of `js/games/slipstream/game.js` (sky, fog, colours, what is on each side: `sea`, `hill`, `mesa`, `valley`) |
| Change a game's music | `THEMES.<game>` at the bottom of that game's file |
| Change the online servers | `BR` (broker list) at the top of `js/core/net.js` |

## Adding a new game

1. Create `js/games/mygame.js` and `css/mygame.css`, then add both to `index.html` (the script goes after `main.js`).
2. In the script, call `mountScreens(html)` with a menu `<section>` and a game `<section>` (both `hidden`).
3. Add the game to `INFO` in `js/core/hub.js` (and `ONLINE`, its online button), plus its two pictures in `img/cards/`.
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

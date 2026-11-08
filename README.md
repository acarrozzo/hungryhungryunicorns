# 🦄 Hungry Hungry Unicorns 🦄

A fairy game for two sisters. Fly your fairy-riding unicorn around the fairy garden and gobble up as many balls as you can while the fairy crowd cheers you on!

## How to play

**Easiest:** double-click `index.html` and it opens in your browser.

**Better (sound and fonts work everywhere, and the iPad can play too):** run a tiny web server from this folder:

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765> on the computer. To play on the iPad, make sure it is on the same Wi-Fi, find the computer's IP address (System Settings → Wi-Fi → Details), and open `http://THAT-IP:8765` in Safari. Tap the share button → "Add to Home Screen" to make it feel like a real app.

## Controls

| Who | Keyboard | Mouse | Touch (1 player) | Touch (2 players) |
| --- | --- | --- | --- | --- |
| Unicorn 1 | Arrow keys | Unicorn flies to the mouse | Unicorn flies to your finger | Drag anywhere on the **left** half |
| Unicorn 2 | W A S D | – | – | Drag anywhere on the **right** half |

In one-player mode, both arrow keys and WASD work. Press `Esc` or the ⏸ button to pause.

## Games

- **⏱️ Timer** — one minute of gobbling. Most balls wins. Your best one-player score is remembered.
- **🎯 Eat Them All** — the round ends when every ball is gone.
- **♾️ Free Play** — balls keep coming forever. Tap ⏸ → "All Done" when you want to see the scores.

## Magic balls

Glowing balls give a fairy power for a few seconds:

- ⚡ **ZOOM!** — super speed
- ⭐ **BIG MOUTH!** — a giant gobbling mouth
- 🧲 **MAGNET!** — balls fly toward you

Every ball you eat makes your unicorn a little bigger and rounder.

## Making changes

Everything is in three files with no build step:

- `index.html` — the screens and buttons
- `style.css` — colors and sizes of the buttons and menus
- `game.js` — the game itself. Easy knobs near the top: `TIMER_SECONDS`, the `UNICORN_COLORS` list (add a new color!), `BALL_COLORS`, the `YUMS` words, and the `POWERS` table.

Sounds are made with the browser's own synthesizer, so there are no audio files to manage.

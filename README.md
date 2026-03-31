# VSCode of Honor — VS Code Extension

A VS Code extension that keeps you coding. Your knight stands in the sidebar, automatically fighting incoming enemy knights **while you type**. Stop typing and your knight goes idle — leaving enemies free to close in and deal damage.

## Getting Started

After installing the extension, open the **Explorer** sidebar (Ctrl+Shift+E). You'll find a **VSCode of Honor** panel at the bottom of the Explorer view. Click it to expand the game.

## How It Works

1. Open the **Explorer** sidebar (Ctrl+Shift+E) and expand the **VSCode of Honor** panel.
2. Start typing in any editor — your knight begins punching approaching enemy knights.
3. Stop typing — after a configurable timeout your knight goes idle and stops fighting.
4. If enemy knights reach your character, they will attack you. At 0 HP it's game over.
5. Survive waves of increasingly fast and numerous enemy knights. Your high score is saved automatically.

## Controls

| Action | Trigger |
|---|---|
| Fight | Type in any VS Code editor (automatic) |
| Stop fighting | Stop typing (idle timeout) |
| Restart after game over | Click the **Reset Game** button in the sidebar |
| Reset all progress | Run command `VSCode of Honor: Reset Game` from the Command Palette (Ctrl+Shift+P) |

## Settings

Open **Settings** (Ctrl+,) and search for `vscodeOfHonor`.

| Setting | Description | Default |
|---|---|---|
| `vscodeOfHonor.idleTimeoutSeconds` | Seconds of inactivity before your knight stops fighting | `5` |

## Installation (Development)

```bash
npm install
npm run compile
```

Press **F5** to launch the Extension Development Host with the extension loaded.

## Project Structure

```
assets/                 — Sprite images (player knight, enemy knights, background)
src/
  extension.ts          — Activation, typing activity tracking, config watching
  gameViewProvider.ts   — WebviewViewProvider with inline game client (HTML5 Canvas)
  messages.ts           — Type-safe message types between extension host and webview
  logic.ts              — Game constants and default state factory
  renderer.ts           — Knight and EnemyKnight drawing classes (reference)
```

## Credits

Sprite and tile art used in this project (both licensed [CC0](http://creativecommons.org/publicdomain/zero/1.0/)):

- **Knight sprites** by [zwonky](https://opengameart.org/users/zwonky) — [Knights](https://opengameart.org/content/knights) on OpenGameArt
- **Background tiles** by [surt](https://opengameart.org/users/surt) — [Fantasy Tiles](https://opengameart.org/content/fantasy-tiles) on OpenGameArt

Thank you for making your art freely available!

## Theme Support

The game automatically adapts to your VS Code theme (light, dark, high contrast). Sky, ground, and character colors update when you switch themes.

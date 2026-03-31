/* ------------------------------------------------------------------ *
 *  Core game logic — pure functions, no DOM / VS Code deps.          *
 *  VSCode of Honor: player stands left, punches enemy knights when active. *
 * ------------------------------------------------------------------ */

import { GameStateSerialized } from "./messages";

// ---- Exported constants (used by renderer) -------------------------

export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 400;
export const MAX_HEALTH = 100;
export const PLAYER_X = 100;                   // left side of screen
export const PLAYER_Y = WORLD_HEIGHT - 80;
export const PUNCH_RANGE = 55;                  // pixels from player center
export const PUNCH_COOLDOWN = 18;               // frames between punches
export const PUNCH_DURATION = 10;               // frames the punch is "active"
export const ENEMY_DAMAGE = 10;

// ---- Factory -------------------------------------------------------

export function createDefaultState(): GameStateSerialized {
  return {
    health: MAX_HEALTH,
    score: 0,
    wave: 1,
    kills: 0,
    highScore: 0,
    gameOver: false,
  };
}

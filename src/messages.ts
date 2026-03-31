/* ------------------------------------------------------------------ *
 *  Type-safe message bridge between extension host ↔ webview.        *
 * ------------------------------------------------------------------ */

// ---- Extension → Webview ------------------------------------------

export interface InitStateMessage {
  type: "initState";
  state: GameStateSerialized;
}

export interface ThemeChangedMessage {
  type: "themeChanged";
  kind: "light" | "dark" | "highContrast";
}

export interface ActivityChangedMessage {
  type: "activityChanged";
  active: boolean;
}

export interface ConfigChangedMessage {
  type: "configChanged";
  idleTimeoutMs: number;
}

export type ExtensionToWebview =
  | InitStateMessage
  | ThemeChangedMessage
  | ActivityChangedMessage
  | ConfigChangedMessage;

// ---- Webview → Extension ------------------------------------------

export interface SaveStateMessage {
  type: "saveState";
  state: GameStateSerialized;
}

export interface ReadyMessage {
  type: "ready";
}

export interface ResetMessage {
  type: "reset";
}

export type WebviewToExtension = SaveStateMessage | ReadyMessage | ResetMessage;

// ---- Shared data shapes -------------------------------------------

export interface GameStateSerialized {
  health: number;
  score: number;
  wave: number;
  kills: number;
  highScore: number;
  gameOver: boolean;
}

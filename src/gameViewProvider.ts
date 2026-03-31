/* ------------------------------------------------------------------ *
 *  WebviewViewProvider — hosts the VSCode of Honor game in sidebar.      *
 * ------------------------------------------------------------------ */

import * as vscode from "vscode";
import {
  GameStateSerialized,
  WebviewToExtension,
  ExtensionToWebview,
} from "./messages";
import { createDefaultState } from "./logic";

const STATE_KEY = "vscodeOfHonor.gameState";

export class GameViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "vscodeOfHonor.gameView";
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'assets')]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (msg: WebviewToExtension) => {
        switch (msg.type) {
          case "ready":
            this.sendState();
            this.sendTheme();
            this.sendConfig(this.getIdleTimeoutMs());
            break;
          case "saveState":
            this.context.globalState.update(STATE_KEY, msg.state);
            break;
          case "reset":
            this.context.globalState.update(STATE_KEY, undefined);
            this.sendState();
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    vscode.window.onDidChangeActiveColorTheme(
      () => this.sendTheme(),
      undefined,
      this.context.subscriptions
    );
  }

  // ---- Public API for extension.ts ----------------------------------

  resetGame() {
    this.context.globalState.update(STATE_KEY, undefined);
    this.sendState();
  }

  sendActivity(active: boolean) {
    this.postMessage({ type: "activityChanged", active });
  }

  sendConfig(idleTimeoutMs: number) {
    this.postMessage({ type: "configChanged", idleTimeoutMs });
  }

  // ---- Private helpers ----------------------------------------------

  getIdleTimeoutMs(): number {
    const cfg = vscode.workspace.getConfiguration("vscodeOfHonor");
    return (cfg.get<number>("idleTimeoutSeconds") ?? 5) * 1000;
  }

  private sendState() {
    const saved =
      this.context.globalState.get<GameStateSerialized>(STATE_KEY);
    const state = saved ?? createDefaultState();
    this.postMessage({ type: "initState", state });
  }

  private sendTheme() {
    const kind = vscode.window.activeColorTheme.kind;
    const isDark =
      kind === vscode.ColorThemeKind.Dark ||
      kind === vscode.ColorThemeKind.HighContrast;
    const isHc = kind === vscode.ColorThemeKind.HighContrast;
    this.postMessage({
      type: "themeChanged",
      kind: isHc ? "highContrast" : isDark ? "dark" : "light",
    });
  }

  private postMessage(msg: ExtensionToWebview) {
    this.view?.webview.postMessage(msg);
  }

  /* ------------------------------------------------------------------
   *  INLINE WEBVIEW HTML — complete game client
   * ------------------------------------------------------------------ */

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    const asset = (name: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'assets', name));
    const sprites = {
      playerStand: asset('main_character_stand.png'),
      playerAttack: asset('main_charcter_attack_right.png'),
      playerDead: asset('main_character_dead.png'),
      enemyStand: asset('enemy_stand.png'),
      enemyWalk1: asset('enemy_walk_right_step_1.png'),
      enemyWalk2: asset('enemy_walk_right_step_2.png'),
      enemyAttack: asset('enemy_attack_left.png'),
      enemyDead: asset('enemy_dead.png'),
      background: asset('background.png'),
    };
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      overflow: hidden;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #ccc);
      font-family: var(--vscode-font-family, monospace);
      font-size: var(--vscode-font-size, 12px);
    }
    #game-canvas {
      display: block;
      width: 100%;
      image-rendering: pixelated;
    }
    #status-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      font-size: 11px;
      border-top: 1px solid var(--vscode-panel-border, #444);
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      display: inline-block;
    }
    .status-dot.active { background: #4ec9b0; }
    .status-dot.inactive { background: #e06c75; }
    #controls {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 4px 8px 8px;
    }
    #controls button {
      font-size: 11px;
      padding: 3px 8px;
      cursor: pointer;
      color: var(--vscode-button-foreground, #fff);
      background: var(--vscode-button-background, #0e639c);
      border: none;
      border-radius: 2px;
    }
    #controls button:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }
    #controls button.secondary {
      color: var(--vscode-button-secondaryForeground, #ccc);
      background: var(--vscode-button-secondaryBackground, #3a3d41);
    }
    #controls button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #505357);
    }
  </style>
</head>
<body>
  <canvas id="game-canvas"></canvas>
  <div id="status-bar">
    <span class="status-dot inactive" id="status-dot"></span>
    <span id="status-text">Inactive — start typing to fight!</span>
  </div>
  <div id="controls">
    <button id="btn-reset" class="secondary">Reset Game</button>
  </div>

  <script nonce="${nonce}">
  (function() {
    const vscode = acquireVsCodeApi();

    // ---- Constants ----
    const W = 800, H = 400;
    const GROUND_Y = Math.floor(H * 0.6299); // grass top line in background.png
    const PX = 100, PY = GROUND_Y - 22;   // player on the LEFT, feet on grass
    const MAX_HP = 100;
    const ENEMY_DAMAGE = 10;
    const ENEMY_ATTACK_COOLDOWN = 60;  // frames between enemy knight punches
    const PUNCH_RANGE = 58;             // how far fist reaches from PX (must be >= PLAYER_HIT_RANGE)
    const PUNCH_COOLDOWN = 18;          // frames between punches
    const PUNCH_DURATION = 10;          // frames the punch hitbox is active
    const PLAYER_HIT_RANGE = 56;        // enemy knight stops where punch sprite reaches player

    let enemyPunchTimer = 0;             // visual frames for enemy punch effect
    const ENEMY_PUNCH_VIS = 10;           // how long the enemy POW! shows

    // ---- Canvas ----
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    let cw = 400, ch = 200;
    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      cw = Math.floor(r.width);
      ch = Math.floor(cw * (H / W));
      canvas.width = cw;
      canvas.height = ch;
    }
    resize();
    window.addEventListener('resize', resize);

    // ---- Sprites ----
    const SPRITE = {};
    const spriteUrls = {
      playerStand:  '${sprites.playerStand}',
      playerAttack: '${sprites.playerAttack}',
      playerDead:   '${sprites.playerDead}',
      enemyStand:   '${sprites.enemyStand}',
      enemyWalk1:   '${sprites.enemyWalk1}',
      enemyWalk2:   '${sprites.enemyWalk2}',
      enemyAttack:  '${sprites.enemyAttack}',
      enemyDead:    '${sprites.enemyDead}',
      background:   '${sprites.background}',
    };
    for (const [key, url] of Object.entries(spriteUrls)) {
      const img = new Image();
      img.onload = () => { SPRITE[key] = img; };
      img.src = url;
    }
    const SP_W = 64, SP_H = 64;  // rendered sprite size in game units

    // ---- Palette ----
    let isDark = true;
    function P() {
      if (isDark) return {
        bg:'#1e1e1e', ground:'#3b3225', sky:'#1e1e2e',
        figActive:'#4ec9b0', figInactive:'#888888',
        enemy:'#6a9955', enemyEye:'#e06c75',
        punchFlash:'#dcdcaa', text:'#cccccc', textDim:'#888888',
        hpBar:'#e06c75', hpBg:'#3a3d41', danger:'rgba(224,108,117,0.15)'
      };
      return {
        bg:'#ffffff', ground:'#8B7355', sky:'#87CEEB',
        figActive:'#16825d', figInactive:'#aaaaaa',
        enemy:'#3b7a1a', enemyEye:'#d73a49',
        punchFlash:'#b08800', text:'#1e1e1e', textDim:'#666666',
        hpBar:'#d73a49', hpBg:'#e0e0e0', danger:'rgba(215,58,73,0.12)'
      };
    }

    // ---- Game state ----
    let state = null;
    let active = false;
    let frame = 0;
    let punchCooldown = 0;
    let punchTimer = 0;          // counts down from PUNCH_DURATION
    let saveCounter = 0;
    let nextEnemyId = 0;

    // Runtime-only arrays
    let enemies = [];   // { id, x, y, hp, maxHp, speed }
    let particles = [];

    // Wave management
    let waveTimer = 0;
    let spawnInterval = 50;
    let spawnTimer = 0;
    let enemiesLeftInWave = 0;
    let wavePending = true;

    function startWave() {
      if (!state) return;
      const w = state.wave;
      enemiesLeftInWave = 3 + w * 2;
      spawnInterval = Math.max(15, 50 - w * 3);
      spawnTimer = 0;
      wavePending = false;
      waveTimer = 0;
    }

    function spawnEnemy() {
      if (!state) return;
      const w = state.wave;
      const speed = 1.2 + Math.random() * 0.8 + w * 0.15;
      const hp = 1 + Math.floor(w / 3);
      enemies.push({
        id: nextEnemyId++,
        x: W + 20,               // always from the RIGHT
        y: PY,
        hp: hp,
        maxHp: hp,
        speed: speed,
        attacking: false,
        attackCooldown: 0
      });
    }

    // ---- Game tick ----
    function gameTick() {
      if (!state || state.gameOver) return;
      frame++;

      // Wave logic
      if (wavePending) {
        waveTimer++;
        if (waveTimer > 60) startWave();
      } else {
        spawnTimer++;
        if (spawnTimer >= spawnInterval && enemiesLeftInWave > 0) {
          spawnTimer = 0;
          spawnEnemy();
          enemiesLeftInWave--;
        }
        if (enemiesLeftInWave <= 0 && enemies.filter(z => !z.dying).length === 0) {
          state.wave++;
          wavePending = true;
        }
      }

      // Punching
      if (punchTimer > 0) punchTimer--;
      if (punchCooldown > 0) punchCooldown--;

      if (active && punchCooldown <= 0) {
        // Check if any enemy knight is in punch range
        let closest = null;
        let closestDist = Infinity;
        for (const z of enemies) {
          if (z.dying) continue;
          const dx = z.x - PX;
          if (dx > 0 && dx < PUNCH_RANGE + 10 && dx < closestDist) {
            closestDist = dx;
            closest = z;
          }
        }
        if (closest) {
          punchCooldown = PUNCH_COOLDOWN;
          punchTimer = PUNCH_DURATION;
        }
      }

      // Punch hit detection (while punch is active)
      if (punchTimer > 0) {
        for (let i = enemies.length - 1; i >= 0; i--) {
          const z = enemies[i];
          if (z.dying) continue;
          const dx = z.x - PX;
          if (dx > 0 && dx <= PUNCH_RANGE) {
            z.hp--;
            // Hit particles
            for (let k = 0; k < 5; k++) {
              particles.push({
                x: z.x - 8, y: z.y - 15,
                dx: (Math.random() - 0.3) * 4,
                dy: (Math.random() - 0.5) * 3,
                life: 12 + Math.random() * 8,
                color: '#dcdcaa'
              });
            }
            if (z.hp <= 0) {
              z.dying = true;
              z.deathTimer = 30;
              z.speed = 0;
              state.kills++;
              state.score += 10 * state.wave;
              if (state.score > state.highScore) state.highScore = state.score;
              // Death particles
              for (let k = 0; k < 8; k++) {
                particles.push({
                  x: z.x, y: z.y - 10,
                  dx: (Math.random() + 0.2) * 4,
                  dy: (Math.random() - 0.5) * 4,
                  life: 20 + Math.random() * 15,
                  color: '#e06c75'
                });
              }
            }
            // Each punch frame can only hit each enemy once
            // (punchTimer ticks handle multi-hit for tough enemies)
            break;
          }
        }
      }

      // Update enemies — all move LEFT toward player
      for (let i = enemies.length - 1; i >= 0; i--) {
        const z = enemies[i];

        // Handle dying enemies
        if (z.dying) {
          z.deathTimer--;
          if (z.deathTimer <= 0) enemies.splice(i, 1);
          continue;
        }

        // Enemy is attacking the player — stay in place and punch periodically
        if (z.attacking) {
          z.attackCooldown--;
          if (z.attackCooldown <= 0) {
            z.attackCooldown = ENEMY_ATTACK_COOLDOWN;
            state.health = Math.max(0, state.health - ENEMY_DAMAGE);
            enemyPunchTimer = ENEMY_PUNCH_VIS;
            for (let k = 0; k < 6; k++) {
              particles.push({
                x: PX + 10, y: PY - 10,
                dx: (Math.random() - 0.7) * 3,
                dy: (Math.random() - 0.5) * 3,
                life: 15 + Math.random() * 10,
                color: '#e06c75'
              });
            }
            if (state.health <= 0) {
              state.gameOver = true;
            }
          }
          continue;
        }

        z.x -= z.speed;

        // Reached the player — stop and start attacking
        if (z.x - PX < PLAYER_HIT_RANGE) {
          z.x = PX + PLAYER_HIT_RANGE; // snap to position
          z.attacking = true;
          z.attackCooldown = 0; // punch immediately on first contact
        }
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.dx;
        pt.y += pt.dy;
        pt.life--;
        if (pt.life <= 0) particles.splice(i, 1);
      }

      // Auto-save every ~5s
      saveCounter++;
      if (saveCounter >= 300) {
        saveCounter = 0;
        vscode.postMessage({ type: 'saveState', state: state });
      }
    }

    // ---- Render ----

    function render() {
      if (!state) return;
      const p = P();
      const sx = cw / W, sy = ch / H;

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.scale(sx, sy);

      // Background image
      const bgImg = SPRITE.background;
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bgImg, 0, 0, W, H);
      } else {
        ctx.fillStyle = p.sky;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = p.ground;
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      }

      // Danger flash when low HP
      if (state.health < 30 && state.health > 0) {
        const pulse = Math.sin(frame * 0.1) * 0.5 + 0.5;
        ctx.fillStyle = 'rgba(224,108,117,' + (pulse * 0.2) + ')';
        ctx.fillRect(0, 0, W, H);
      }

      // ---- Particles ----
      for (const pt of particles) {
        const alpha = pt.life / 25;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ---- Enemy Knights ----
      for (const z of enemies) {
        drawEnemy(ctx, z, p);
      }

      // ---- Player ----
      drawPlayer(ctx, p);

      // ---- Enemy punch effect on player ----
      if (enemyPunchTimer > 0) {
        enemyPunchTimer--;
        const ep = enemyPunchTimer / ENEMY_PUNCH_VIS;
        ctx.strokeStyle = '#e06c75';
        ctx.lineWidth = 2;
        ctx.globalAlpha = ep;
        ctx.beginPath();
        ctx.arc(PX + 5, PY - 16, 12, Math.PI - 0.8, Math.PI + 0.8);
        ctx.stroke();
        if (enemyPunchTimer > ENEMY_PUNCH_VIS - 4) {
          ctx.font = 'bold 14px monospace';
          ctx.fillStyle = '#e06c75';
          ctx.fillText('POW!', PX - 30, PY - 30);
        }
        ctx.globalAlpha = 1;
      }

      // ---- Punch effect ----
      if (punchTimer > 0) {
        const progress = punchTimer / PUNCH_DURATION;
        // Impact arc
        ctx.strokeStyle = p.punchFlash;
        ctx.lineWidth = 2;
        ctx.globalAlpha = progress;
        ctx.beginPath();
        ctx.arc(PX + PUNCH_RANGE - 5, PY - 16, 12, -0.8, 0.8);
        ctx.stroke();
        // "POW" text
        if (punchTimer > PUNCH_DURATION - 4) {
          ctx.font = 'bold 14px monospace';
          ctx.fillStyle = p.punchFlash;
          ctx.fillText('POW!', PX + PUNCH_RANGE + 5, PY - 30);
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore(); // undo scale

      // ---- HUD (unscaled pixel coords) ----
      drawHUD(ctx, state, p, cw, ch);

      // ---- Game Over overlay ----
      if (state.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e06c75'; ctx.font = 'bold 24px monospace';
        ctx.fillText('GAME OVER', cw / 2, ch / 2 - 20);
        ctx.fillStyle = '#ccc'; ctx.font = '13px monospace';
        ctx.fillText('Score: ' + state.score + '  |  Kills: ' + state.kills + '  |  Wave: ' + state.wave, cw / 2, ch / 2 + 8);
        ctx.fillText('High Score: ' + state.highScore, cw / 2, ch / 2 + 28);
        ctx.fillStyle = '#4ec9b0'; ctx.font = '12px monospace';
        ctx.fillText('Click "Reset Game" to try again', cw / 2, ch / 2 + 52);
        ctx.textAlign = 'start';
      }
    }

    function drawPlayer(ctx, p) {
      ctx.imageSmoothingEnabled = false;
      let sprite;
      if (state.gameOver) {
        sprite = SPRITE.playerDead;
      } else if (punchTimer > 0) {
        sprite = SPRITE.playerAttack;
      } else {
        sprite = SPRITE.playerStand;
      }

      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        const dy = PY - SP_H + 22;
        ctx.drawImage(sprite, PX - SP_W / 2, dy, SP_W, SP_H);
      }

      // Status indicator above head
      if (!state.gameOver) {
        ctx.fillStyle = active ? '#4ec9b0' : '#e06c75';
        ctx.beginPath(); ctx.arc(PX, PY - SP_H + 10, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawEnemy(ctx, z, p) {
      ctx.imageSmoothingEnabled = false;
      let sprite;
      if (z.dying) {
        sprite = SPRITE.enemyDead;
      } else if (z.attacking) {
        // Alternate between stand and attack punch animation
        sprite = (z.attackCooldown <= 15) ? SPRITE.enemyAttack : SPRITE.enemyStand;
      } else {
        // Walking — alternate frames; walk sprites face right, so flip
        sprite = (Math.floor(frame / 15 + z.id) % 2 === 0)
          ? SPRITE.enemyWalk1 : SPRITE.enemyWalk2;
      }

      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        const dy = z.y - SP_H + 22;
        ctx.drawImage(sprite, z.x - SP_W / 2, dy, SP_W, SP_H);
      }

      // HP bar if wounded and alive
      if (!z.dying && z.hp < z.maxHp) {
        const bw = 20;
        ctx.fillStyle = p.hpBg;
        ctx.fillRect(z.x - bw / 2, z.y - SP_H + 5, bw, 3);
        ctx.fillStyle = p.enemyEye;
        ctx.fillRect(z.x - bw / 2, z.y - SP_H + 5, bw * (z.hp / z.maxHp), 3);
      }
    }

    function drawHUD(ctx, state, p, cw, ch) {
      const bx = 8, bw = 90, bh = 8;
      let by = 8;

      // Health bar
      ctx.fillStyle = p.text; ctx.font = '11px monospace';
      ctx.fillText('HP', bx, by + 8);
      ctx.fillStyle = p.hpBg;
      ctx.fillRect(bx + 22, by, bw, bh);
      ctx.fillStyle = state.health > 25 ? p.hpBar : '#e06c75';
      ctx.fillRect(bx + 22, by, bw * (state.health / MAX_HP), bh);
      ctx.strokeStyle = p.textDim; ctx.lineWidth = 1;
      ctx.strokeRect(bx + 22, by, bw, bh);
      ctx.fillStyle = p.text;
      ctx.fillText(Math.ceil(state.health).toString(), bx + 22 + bw + 4, by + 8);

      // Score / wave / kills
      by += 18;
      ctx.fillStyle = p.text; ctx.font = '11px monospace';
      ctx.fillText('Score: ' + state.score, bx, by + 8);
      by += 14;
      ctx.fillText('Wave: ' + state.wave, bx, by + 8);
      by += 14;
      ctx.fillStyle = p.textDim;
      ctx.fillText('Kills: ' + state.kills, bx, by + 8);
      by += 14;
      ctx.fillText('Best: ' + state.highScore, bx, by + 8);

      // Active status top-right
      ctx.textAlign = 'right';
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = active ? '#4ec9b0' : '#e06c75';
      ctx.fillText(active ? 'ACTIVE' : 'IDLE', cw - 8, 16);
      ctx.font = '10px monospace';
      ctx.fillStyle = p.textDim;
      ctx.fillText(active ? 'Keep typing!' : 'Type to punch!', cw - 8, 28);
      ctx.textAlign = 'start';
    }

    // ---- Game loop ----
    const STEP_MS = 1000 / 60;
    const INTERVAL_MS = 1000 / 30;
    let lastTick = Date.now();

    function loop() {
      const now = Date.now();
      let elapsed = now - lastTick;
      lastTick = now;
      if (elapsed > 500) elapsed = 500;

      const steps = Math.floor(elapsed / STEP_MS);
      for (let i = 0; i < steps; i++) {
        gameTick();
      }
      render();
    }

    // ---- DOM ----
    const dot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    function updateStatusUI() {
      dot.className = 'status-dot ' + (active ? 'active' : 'inactive');
      statusText.textContent = active
        ? 'Active — fighting knights!'
        : 'Inactive — start typing to fight!';
    }

    document.getElementById('btn-reset').addEventListener('click', () => {
      vscode.postMessage({ type: 'reset' });
      enemies = []; particles = [];
      wavePending = true; waveTimer = 0;
      punchTimer = 0; punchCooldown = 0;
    });

    // ---- Message handling ----
    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'initState':
          state = msg.state;
          enemies = []; particles = [];
          wavePending = true; waveTimer = 0;
          punchTimer = 0; punchCooldown = 0;
          break;
        case 'themeChanged':
          isDark = msg.kind === 'dark' || msg.kind === 'highContrast';
          break;
        case 'activityChanged':
          active = msg.active;
          updateStatusUI();
          break;
        case 'configChanged':
          break;
      }
    });

    // ---- Boot ----
    vscode.postMessage({ type: 'ready' });
    updateStatusUI();
    setInterval(loop, INTERVAL_MS);
  })();
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

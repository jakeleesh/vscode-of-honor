/* ------------------------------------------------------------------ *
 *  Canvas renderer — knight figures, enemy knights, punch effect, HUD. *
 *  Reference module: the drawing logic is also inlined in the        *
 *  webview HTML. Kept here for type-checking and documentation.      *
 * ------------------------------------------------------------------ */

// ---- Color palette (theme-aware) -----------------------------------

export interface Palette {
  bg: string;
  ground: string;
  sky: string;
  figure: string;
  figureActive: string;
  figureInactive: string;
  enemy: string;
  enemyEye: string;
  punchFlash: string;
  textPrimary: string;
  textSecondary: string;
  healthBar: string;
  healthBarBg: string;
  dangerFlash: string;
}

export function buildPalette(isDark: boolean): Palette {
  if (isDark) {
    return {
      bg: "#1e1e1e",
      ground: "#3b3225",
      sky: "#1e1e2e",
      figure: "#d4d4d4",
      figureActive: "#4ec9b0",
      figureInactive: "#888888",
      enemy: "#6a9955",
      enemyEye: "#e06c75",
      punchFlash: "#dcdcaa",
      textPrimary: "#cccccc",
      textSecondary: "#888888",
      healthBar: "#e06c75",
      healthBarBg: "#3a3d41",
      dangerFlash: "rgba(224,108,117,0.15)",
    };
  }
  return {
    bg: "#ffffff",
    ground: "#8B7355",
    sky: "#87CEEB",
    figure: "#1e1e1e",
    figureActive: "#16825d",
    figureInactive: "#aaaaaa",
    enemy: "#3b7a1a",
    enemyEye: "#d73a49",
    punchFlash: "#b08800",
    textPrimary: "#1e1e1e",
    textSecondary: "#666666",
    healthBar: "#d73a49",
    healthBarBg: "#e0e0e0",
    dangerFlash: "rgba(215,58,73,0.12)",
  };
}

// ---- Stick Figure (Player) -----------------------------------------

export type PlayerAnim = "idle" | "punching";

export class StickFigure {
  private frame = 0;

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    palette: Palette,
    anim: PlayerAnim,
    punchProgress: number // 0..1  (0 = not punching, 1 = fully extended)
  ) {
    this.frame++;
    const dir = 1; // always facing right

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle =
      anim === "punching" ? palette.figureActive : palette.figureInactive;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Head
    ctx.beginPath();
    ctx.arc(0, -30, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, 4);
    ctx.stroke();

    // Punch arm (front) — extends outward when punching
    const punchExtend = punchProgress * 24;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(dir * (12 + punchExtend), -16 - punchProgress * 4);
    ctx.stroke();

    // Fist
    if (anim === "punching" && punchProgress > 0.3) {
      ctx.fillStyle = palette.figureActive;
      ctx.beginPath();
      ctx.arc(dir * (14 + punchExtend), -16 - punchProgress * 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Back arm
    ctx.strokeStyle =
      anim === "punching" ? palette.figureActive : palette.figureInactive;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(-dir * 12, -6);
    ctx.stroke();

    // Legs (slight idle sway)
    const sway = Math.sin(this.frame * 0.05) * 2;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(-10 + sway, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(10 + sway, 22);
    ctx.stroke();

    // Eyes
    ctx.fillStyle =
      anim === "punching" ? palette.figureActive : palette.figureInactive;
    ctx.beginPath();
    ctx.arc(-3, -32, 1.2, 0, Math.PI * 2);
    ctx.arc(3, -32, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ---- Enemy Knight Figure -------------------------------------------

export class EnemyKnightFigure {
  private frame = 0;

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    palette: Palette,
    hp: number,
    maxHp: number
  ) {
    this.frame++;
    const dir = -1; // always walking left toward player
    const swing = Math.sin(this.frame * 0.12) * 10;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = palette.enemy;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Head
    ctx.beginPath();
    ctx.arc(0, -28, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Body (slightly hunched)
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(dir * 2, 4);
    ctx.stroke();

    // Arms reaching forward (toward left / player)
    ctx.beginPath();
    ctx.moveTo(dir * 2, -14);
    ctx.lineTo(dir * 20, -18 + swing * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dir * 2, -10);
    ctx.lineTo(dir * 18, -12 - swing * 0.3);
    ctx.stroke();

    // Legs (shambling)
    ctx.beginPath();
    ctx.moveTo(dir * 2, 4);
    ctx.lineTo(-8 + swing, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dir * 2, 4);
    ctx.lineTo(8 - swing, 22);
    ctx.stroke();

    // Red eyes
    ctx.fillStyle = palette.enemyEye;
    ctx.beginPath();
    ctx.arc(dir * 2 - 3, -30, 1.5, 0, Math.PI * 2);
    ctx.arc(dir * 2 + 3, -30, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // HP indicator (small bar above head)
    if (hp < maxHp) {
      const barW = 14;
      const frac = hp / maxHp;
      ctx.fillStyle = palette.healthBarBg;
      ctx.fillRect(-barW / 2, -42, barW, 3);
      ctx.fillStyle = palette.enemyEye;
      ctx.fillRect(-barW / 2, -42, barW * frac, 3);
    }

    ctx.restore();
  }
}

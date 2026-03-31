/* ------------------------------------------------------------------ *
 *  Extension entry point — tracks typing activity in the editor      *
 *  and forwards active/inactive status to the game webview.          *
 * ------------------------------------------------------------------ */

import * as vscode from "vscode";
import { GameViewProvider } from "./gameViewProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new GameViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GameViewProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscodeOfHonor.resetGame", () => {
      provider.resetGame();
    })
  );

  // ---- Typing activity tracking ------------------------------------

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let isActive = false;

  function getIdleTimeoutMs(): number {
    const cfg = vscode.workspace.getConfiguration("vscodeOfHonor");
    return (cfg.get<number>("idleTimeoutSeconds") ?? 5) * 1000;
  }

  function markActive() {
    if (!isActive) {
      isActive = true;
      provider.sendActivity(true);
    }
    // Reset the idle timer
    if (idleTimer) { clearTimeout(idleTimer); }
    idleTimer = setTimeout(() => {
      isActive = false;
      provider.sendActivity(false);
    }, getIdleTimeoutMs());
  }

  // Fire on every text document change (i.e. the user typed something)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {
      markActive();
    })
  );

  // Also send current config to webview when it changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("vscodeOfHonor")) {
        provider.sendConfig(getIdleTimeoutMs());
        // Re-arm idle timer with new duration
        if (isActive) { markActive(); }
      }
    })
  );
}

export function deactivate() {}

import * as vscode from "vscode";

export async function activate(context: vscode.ExtensionContext) {
  console.log("Hocus Workspace Activated");
}

export function deactivate() {
  console.log("Hocus Workspace Deactivated");
}

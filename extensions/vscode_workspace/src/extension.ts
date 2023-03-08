import * as fs from "fs-extra";
import * as os from "os";
import * as vscode from "vscode";

const HOCUS_DIR = "/home/hocus/dev/.hocus/";

export async function isHocusWorkspace(): Promise<boolean> {
  // No need to probe if running in the web or locally
  if (vscode.env.remoteName === void 0 || vscode.env.uiKind !== vscode.UIKind.Desktop) {
    return false;
  }

  // Assume that if this magic folder exists and we're on linux then we're in a Hocus workspace
  const platform = os.platform();
  return platform === "linux" && await fs.exists(HOCUS_DIR);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("Hocus Workspace Activated");
  const isWorkspace = await isHocusWorkspace();
  console.log(isWorkspace);

}

export function deactivate() {
  console.log("Hocus Workspace Deactivated");
}

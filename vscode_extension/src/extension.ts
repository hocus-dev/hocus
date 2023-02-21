import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("Hocus Activated");
  // TODO: Detect if we are inside a Hocus VM
  // TODO: The simplest way is to check for a JWT/OIDC token
  // For now don't hide anything in the UI
  vscode.commands.executeCommand("setContext", "hocus.insideHocusVM", true);

  // TODO: Attach terminals to tasks

  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
      // TODO: parse the URL, connect to the remote machine and/or write the required ssh config
      vscode.window.showInformationMessage(`Hocus URI handler called: ${uri.toString()}`);
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("hocus.stopWorkspace", () => {
      // TODO: Stop the workspace
      vscode.window.showInformationMessage("TODO");
    }),
  );
}

export function deactivate() {
  console.log("Hocus Deactivated");
}

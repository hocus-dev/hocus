import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

/* TODO: Windows support */
async function ensureSupportedPlatform() {
  const platform = os.platform();

  if (platform !== "linux" && platform !== "darwin") {
    vscode.window.showInformationMessage(`Unsupported platform ${platform} - TODO!`);
    throw new Error("Nope");
  }
}

/* TODO: Include statements are only supported from OpenSSH 7.3 released August 01, 2016 
*  Inform the user if the SSH client is too old...
*  Knowing debian users they surely will hit this case...
*/
async function ensureSshNewEnough() {
  // ssh -V
  // OpenSSH_9.2p1, OpenSSL 3.0.8 7 Feb 2023
  return;
}

async function getSshConfigDir() {
  // TODO: Windows support
  return path.join(os.homedir(), ".ssh");
}

async function ensureSshDirsExists() {
  const userSshDir = await getSshConfigDir();
  const hocusSshDir = path.join(userSshDir, "hocus");
  for (const dir of [userSshDir, hocusSshDir]) {
    if (!await fs.exists(dir)) {
      console.log(`Creating ${dir} dir`);
      await fs.mkdir(dir);
      await fs.chmod(dir, 0o700);
    }
  }
}

async function ensureSshConfigSetUp() {
  await ensureSshDirsExists();
  const userSshDir = await getSshConfigDir();
  const sshUserConfigPath = path.join(userSshDir, "config");
  const sshHocusConfigPath = path.join(userSshDir, "hocus", "config");
  for (const [filePath, fileDefault] of [[sshUserConfigPath, "# This is the ssh client user configuration file. See\n# ssh_config(5) for more information.\n\n"], [sshHocusConfigPath, "# Don't edit this file - your changes will be overwritten!\n# This file is managed by the Hocus Vscode integration!\n"]] as const) {
    if (!await fs.exists(filePath)) {
      console.log(`Creating ssh config ${filePath}`);
      await fs.createFile(filePath);
      await fs.chmod(filePath, 0o600);
      await fs.writeFile(filePath, fileDefault)
    }
  }

  const config = await fs.readFile(sshUserConfigPath);
  if (!config.includes("Include hocus/config")) {
    console.log(`Installing integration into ssh config`);
    // Now ensure the Hocus config path is included
    fs.appendFile(sshUserConfigPath, "\n\n# Beginning of Hocus Vscode integration\nHost *.hocus.dev\n    Include hocus/config\n# End of Hocus Vscode integration\n")
  }
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("Hocus Activated");

  await ensureSupportedPlatform();
  await ensureSshNewEnough();
  await ensureSshConfigSetUp();

  // TODO: Detect if we are inside a Hocus VM
  // TODO: The simplest way is to check for a JWT/OIDC token
  // For now don't hide anything in the UI
  vscode.commands.executeCommand("setContext", "hocus.insideHocusVM", true);

  /* * Resources with the `file` scheme come from the] same extension host as the extension.
   * * Resources with the `vscode-local` scheme come from an extension host running in the same place as the UI. */

  // TODO: Attach terminals to tasks
  //vscode.window.showTextDocument(vscode.Uri.parse("vscode-local:/proc/self/status"));

  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
      vscode.workspace.fs
        .readDirectory(vscode.Uri.parse("vscode-local:/proc/self/"))
        .then(console.log);

      vscode.workspace.fs
        .readDirectory(vscode.Uri.parse("vscode-local:${userHome}"))
        .then(console.log);

      console.log(vscode.workspace.fs.isWritableFileSystem("vscode-local:/home/zxcvq"));
      console.log(vscode.workspace.fs.isWritableFileSystem("vscode-local:/home/gorbak25"));
      console.log(process.env);

      vscode.workspace
        .openTextDocument(vscode.Uri.parse("vscode-local:/proc/self/status"))
        .then((x) => console.log(x.getText()));

      console.log(vscode.extensions.all);
      console.log(vscode.extensions.getExtension("vscode-local:/ms-vscode-remote.remote-ssh"));
      console.log(context);
      console.log(vscode.window.activeTextEditor?.document.uri);

      const p = new URLSearchParams(uri.query);
      const agentHostname = p.get("agent-hostname");
      const workspaceHostname = p.get("workspace-hostname");
      console.log(agentHostname);
      console.log(workspaceHostname);

      // TODO: parse the URL, connect to the remote machine and/or write the required ssh config
      vscode.window.showInformationMessage(`Hocus URI handler called: ${uri.toString()}`);

      /*vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.parse("vscode-remote://ssh-remote+myubuntubox/home/x/projects/foo"),
      );*/
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

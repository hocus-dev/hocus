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

async function getUserSshConfigDir() {
  // TODO: Windows support
  return path.join(os.homedir(), ".ssh");
}

async function getHocusSshConfigPath() {
  // TODO: Windows support
  return path.join(await getUserSshConfigDir(), "hocus", "config");
}

async function ensureSshDirsExists() {
  const userSshDir = await getUserSshConfigDir();
  const hocusSshDir = path.join(userSshDir, "hocus");
  for (const dir of [userSshDir, hocusSshDir]) {
    if (!await fs.exists(dir)) {
      console.log(`Creating ${dir} dir`);
      await fs.mkdir(dir);
      await fs.chmod(dir, 0o700);
    }
  }
}

// This also serves as a versioning string, If this changes the old config will be deleted
const hocusSshConfigBaner = "# Don't edit this file - your changes WILL be overwritten!!!\n# Please perform customizations in the main config file under Host *.hocus.dev\n# This file is managed by Hocus\n# Hocus SSH Integration 0.0.1\n" as const;

async function ensureSshConfigSetUp(recursed?: boolean) {
  await ensureSshDirsExists();
  const userSshDir = await getUserSshConfigDir();
  const sshUserConfigPath = path.join(userSshDir, "config");
  const sshHocusConfigPath = await getHocusSshConfigPath();
  for (const [filePath, fileDefault] of [[sshUserConfigPath, "# This is the ssh client user configuration file. See\n# ssh_config(5) for more information.\n\n"], [sshHocusConfigPath, hocusSshConfigBaner]] as const) {
    if (!await fs.exists(filePath)) {
      console.log(`Creating ssh config ${filePath}`);
      await fs.createFile(filePath);
      await fs.chmod(filePath, 0o600);
      await fs.writeFile(filePath, fileDefault)
    }
  }

  // Ensure the Hocus config path is included
  const userConfig = await fs.readFile(sshUserConfigPath);
  if (!userConfig.includes("Include hocus/config")) {
    console.log(`Installing integration into ssh config`);

    fs.appendFile(sshUserConfigPath, "\n\n# Beginning of Hocus Vscode integration\nHost *.hocus.dev\n    Include hocus/config\n# End of Hocus Vscode integration\n")
  }

  // Ensure the baner is up to date - if not then delete the config
  const hocusConfig = await fs.readFile(sshHocusConfigPath);
  if (!hocusConfig.includes(hocusSshConfigBaner)) {
    await fs.rm(sshHocusConfigPath);

    // Time to recurse
    if (recursed !== void 0) {
      vscode.window.showInformationMessage(`Fatal error - failed to install SSH configs. Did more than 2 install calls`);
      return;
    }
    ensureSshConfigSetUp(true);
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
  //vscode.commands.executeCommand("setContext", "hocus.insideHocusVM", true);

  // TODO: Attach terminals to tasks
  //vscode.window.showTextDocument(vscode.Uri.parse("vscode-local:/proc/self/status"));

  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
      const p = new URLSearchParams(uri.query);
      if (uri.path !== "/connect") {
        vscode.window.showInformationMessage(`Unsupported path: ${uri.path}`);
        return;
      }

      const agentHostname = p.get("agent-hostname");
      const workspaceHostname = p.get("workspace-hostname");
      const workspaceName = p.get("workspace-name");

      for (const x of [agentHostname, workspaceHostname, workspaceName]) {
        // Kind of permissive but should be mostly enough for now
        if (x === void 0 || x === null || x.match(/^[0-9a-zA-Z\.\-\_]*$/g) === null) {
          vscode.window.showInformationMessage(`Invalid callback parameter: ${x}`);
          return;
        }
      }

      // TODO: Key management
      // TODO: Delete unused workspaces
      getHocusSshConfigPath().then(async (path) => {
        const config = await fs.readFile(path);
        if (!config.includes(`Host ${workspaceName}.hocus.dev`)) {
          await fs.appendFile(path, `
Host ${workspaceName}.hocus.dev
    HostName ${workspaceHostname}
    User hocus
    ProxyJump sshgateway@${agentHostname}:8822
    UserKnownHostsFile /dev/null
    StrictHostKeyChecking no
    ForwardAgent yes
    AddKeysToAgent yes
`
          )
        }
        await
          vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.parse(`vscode-remote://ssh-remote+${workspaceName}.hocus.dev/home/hocus/dev/project`),
          );
      })
    },
  });

  /*context.subscriptions.push(
    vscode.commands.registerCommand("hocus.stopWorkspace", () => {
      // TODO: Stop the workspace
      vscode.window.showInformationMessage("TODO");
    }),
  );*/
}

export function deactivate() {
  console.log("Hocus Deactivated");
}

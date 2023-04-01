import * as child_process from "child_process";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

const HOCUS_PROJECT_LOCATION = "/home/hocus/dev/project";

async function ensureSupportedPlatform() {
  const platform = os.platform();

  if (platform !== "linux" && platform !== "darwin" && platform !== "win32") {
    vscode.window.showInformationMessage(`Unsupported platform ${platform} - TODO!`);
    throw new Error("Nope");
  }
}

async function waitForProcessOutput(command: string, args: string[]): Promise<{ stderr: string, stdout: string }> {
  const cp = child_process.spawn(command, args, { timeout: 2_000, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = "";
  let stderr = "";
  let ends = 0;
  await new Promise((resolve, reject) => {
    const endF = () => { ends += 1; if (ends == 2) { resolve(void 0); } };
    cp.on("error", (err) => reject(err));
    cp.stdout.setEncoding('utf8');
    cp.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    })
    cp.stdout.on("end", endF);
    cp.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    })
    cp.stderr.on("end", endF);
  });
  return { stdout, stderr };
}

interface OpenSSHVersion {
  major: number;
  minor: number;
}

function mkSSHVersion(major: number, minor: number): OpenSSHVersion {
  return { major, minor };
}

function sshVersionCmp(a: OpenSSHVersion, b: OpenSSHVersion): number {
  const major = a.major - b.major;
  const minor = a.minor - b.minor;
  return major === 0 ? minor : major
}

interface SSHVersionSpec {
  // Blacklisted SSH versions
  blacklist: OpenSSHVersion[],
  minimumVersion: OpenSSHVersion
}

// TODO: Perhaps this should be per vendor and not per platform? There are at least 2 vendors on Windows >.<
type SupportedPlatforms = "win32" | "linux" | "darwin";
const REQUIRED_SSH_VERSION: Record<SupportedPlatforms, SSHVersionSpec> = {
  "win32": {
    // For some reason the default version shipped on Windows is 8.6...
    minimumVersion: mkSSHVersion(8, 9),
    blacklist: []
  },
  linux: {
    minimumVersion: mkSSHVersion(7, 3),
    blacklist: []
  },
  darwin: {
    minimumVersion: mkSSHVersion(7, 3),
    blacklist: []
  }
};

/* 
  Include statements are only supported from OpenSSH 7.3 released August 01, 2016
 * On Windows some OpenSSH_for_Windows versions get borked when the agent receives a request for SSH agent restriction .-.
 */
async function ensureSshNewEnough() {
  // Example version strings:
  // ssh -V
  // Archlinux:        OpenSSH_9.2p1, OpenSSL 3.0.8 7 Feb 2023
  // Windows Git Bash: OpenSSH_9.2p1, OpenSSL 1.1.1t  7 Feb 2023
  // Windows:          OpenSSH_for_Windows_9.2p1, LibreSSL 3.6.1
  // Windows:          OpenSSH_for_Windows_8.6p1, LibreSSL 3.4.3
  let out;
  try {
    out = await waitForProcessOutput("ssh", ["-V"]);
  } catch (err) {
    if ((err as any).code === "ENOENT") {
      vscode.window.showInformationMessage(`Warning - SSH client not found!`);
      return;
    }
    console.error(err)
    vscode.window.showInformationMessage(`Warning - Could not detect SSH version!`);
    return;
  }

  const matches = [...out.stderr.matchAll(/(OpenSSH_|OpenSSH_for_Windows_)(?<major>[0-9]+)\.(?<minor>[0-9]+)/ig)];
  if (matches.length !== 1) {
    vscode.window.showInformationMessage(`Warning - Unable to detect SSH version from ${out.stderr}!`);
    console.log(out);
    return;
  }
  const sshVersion = mkSSHVersion(+(matches[0].groups as any).major, +(matches[0].groups as any).minor);
  const platformConfig = REQUIRED_SSH_VERSION[os.platform() as SupportedPlatforms];
  if (sshVersionCmp(platformConfig.minimumVersion, sshVersion) > 0 || platformConfig.blacklist.find((x) => sshVersionCmp(x, sshVersion) === 0) !== void 0) {
    vscode.window.showErrorMessage(`Detected an unsupported SSH version:\n${out.stderr}Please upgrade to at least OpenSSH ${platformConfig.minimumVersion.major}.${platformConfig.minimumVersion.minor}`, { modal: true });
    throw new Error("Unsupported SSH version");
  }
  console.log("SSH Version ok")
  return;
}

async function getUserSshConfigDir() {
  return path.join(os.homedir(), ".ssh");
}

async function getHocusSshConfigPath() {
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
const hocusSshConfigBaner = "# Don't edit this file - your changes WILL be overwritten!!!\n# Please perform customizations in the main config file under Host *.hocus.dev\n# This file is managed by Hocus\n# Hocus SSH Integration 0.0.3\n" as const;

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

async function ensureRemoteExtensionSideloading() {
  const remoteSSHconfig = vscode.workspace.getConfiguration('remote.SSH');
  const defaultExtConfigInfo = remoteSSHconfig.inspect<string[]>('defaultExtensions');
  const defaultExtensions = defaultExtConfigInfo?.globalValue ?? [];
  if (!defaultExtensions.includes('hocus.hocus-remote')) {
    defaultExtensions.unshift('hocus.hocus-remote');
    await remoteSSHconfig.update('defaultExtensions', defaultExtensions, vscode.ConfigurationTarget.Global);
  }
}

// So we aren't prompted every time about the platform when connecting on Windows
// TODO: Revisit this when https://github.com/microsoft/vscode-remote-release/issues/2997 gets closed
// TODO: Should this be ran only on Windows?
async function ensureRemotePlatformIsSet(workspaceHostname: string) {
  const remoteSSHconfig = vscode.workspace.getConfiguration('remote.SSH');
  const defaultExtConfigInfo = remoteSSHconfig.inspect<Record<string, string>>('remotePlatform');
  const remotePlatforms = defaultExtConfigInfo?.globalValue ?? {};
  if (!remotePlatforms[workspaceHostname]) {
    remotePlatforms[workspaceHostname] = 'linux';
    await remoteSSHconfig.update('remotePlatform', remotePlatforms, vscode.ConfigurationTarget.Global);
  }
}

function shouldOpenWorkspaceInNewWindow(): boolean {
  // Check if we have an vscode workspace open
  const remoteUri = vscode.workspace.workspaceFile || vscode.workspace.workspaceFolders?.[0].uri;
  // We should open a new window if there is already something opened
  return remoteUri !== void 0;
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("Hocus Activated");

  await ensureSupportedPlatform();
  await ensureSshNewEnough();
  await ensureSshConfigSetUp();
  await ensureRemoteExtensionSideloading();

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
      const workspaceRoot = p.get("workspace-root");

      for (const x of [agentHostname, workspaceHostname, workspaceName, workspaceRoot]) {
        // Kind of permissive but should be mostly enough for now
        if (x === void 0 || x === null || x.match(/^[0-9a-zA-Z\.\-\_\/]*$/g) === null) {
          vscode.window.showInformationMessage(`Invalid callback parameter: ${x}`);
          return;
        }
      }

      // TODO: Key management
      // TODO: Delete unused workspaces
      getHocusSshConfigPath().then(async (hocusSshConfigPath) => {
        const config = await fs.readFile(hocusSshConfigPath).catch(async () => {
          // If the user manually deletes the hocus config while vscode is open
          // then we need to set up the config again
          console.log("The hocus config probably was deleted, reinitializing")
          await ensureSshConfigSetUp();
          return fs.readFile(hocusSshConfigPath);
        });

        const startMarker = `\n#<${workspaceName}>`;
        const endMarker = `#</${workspaceName}>\n`;

        const startMarkerPos = config.indexOf(startMarker);
        if (startMarkerPos !== -1) {
          // Welp it's possible for the IP to change - the workspace
          // might have been moved to another agent or just got another IP on the same agent
          const endMarkerPos = config.indexOf(endMarker, startMarkerPos + startMarker.length);
          if (endMarkerPos === -1) {
            vscode.window.showInformationMessage(`Fatal error - Failed to find end marker`);
            return;
          }

          await fs.writeFile(hocusSshConfigPath, Buffer.concat([config.slice(0, startMarkerPos), config.slice(endMarkerPos + endMarker.length)]))
        }

        await fs.appendFile(hocusSshConfigPath, `
#<${workspaceName}>
Host ${workspaceName}.hocus.dev
    HostName ${workspaceHostname}
    User hocus
    ProxyJump sshgateway@${agentHostname}:8822
    UserKnownHostsFile /dev/null
    StrictHostKeyChecking no
    ForwardAgent yes
    AddKeysToAgent yes
#</${workspaceName}>
`
        )

        await ensureRemotePlatformIsSet(`${workspaceName}.hocus.dev`);
        await ensureRemoteExtensionSideloading();
        await
          vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.parse(`vscode-remote://ssh-remote+${workspaceName}.hocus.dev${path.posix.join(HOCUS_PROJECT_LOCATION, workspaceRoot as string)}`),
            { forceNewWindow: shouldOpenWorkspaceInNewWindow(), noRecentEntry: true }
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

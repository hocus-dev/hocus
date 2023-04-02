import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { isUnix, isWindows, mapenum, PLATFORM, valueof, waitForProcessOutput } from "./utils";

type SSH_VENDOR = valueof<typeof SSH_VENDOR>;
const SSH_VENDOR = {
  CORE_PORTABLE: "ssh_vendor_core_portable",
  GIT_FOR_WINDOWS: "ssh_vendor_git_for_windows",
  OPENSSH_FOR_WINDOWS: "ssh_vendor_openssh_for_windows"
} as const;

const BUG_REPORT_URL = "https://github.com/hocus-dev/hocus/issues/new/choose";
const WINDOWS_SSH_INSTALL_URL = "https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse?tabs=powershell#install-openssh-for-windows";
const HOCUS_PROJECT_LOCATION = "/home/hocus/dev/project";

const SSH_VENDOR_UPGRADE_LINK = mapenum<SSH_VENDOR>()({
  // To be honest you are probably on some enterprise system
  // I've checked that all current active LTS Ubuntu and Debian versions should have new enough SSH
  [SSH_VENDOR.CORE_PORTABLE]: "https://askubuntu.com/questions/1189747/is-possible-to-upgrade-openssh-server-openssh-7-6p1-to-openssh-8-0p1",
  [SSH_VENDOR.GIT_FOR_WINDOWS]: "https://gitforwindows.org/",
  [SSH_VENDOR.OPENSSH_FOR_WINDOWS]: "https://github.com/PowerShell/Win32-OpenSSH/wiki/Install-Win32-OpenSSH#install-using-winget"
})

const SSH_VENDOR_SETUP_AGENT_LINK = mapenum<SSH_VENDOR>()({
  [SSH_VENDOR.CORE_PORTABLE]: "https://wiki.archlinux.org/title/SSH_keys#ssh-agent",
  [SSH_VENDOR.GIT_FOR_WINDOWS]: "https://gist.github.com/adojos/5aab5e1dcedc16957c465be0212ea099#a4-update-bashrc-file-inside-user-home-folder",
  [SSH_VENDOR.OPENSSH_FOR_WINDOWS]: "https://gist.github.com/gorbak25/fe90bc2f35afe394477db9d459e11a26"
})

async function tryOpenUrlInBrowser(url: string): Promise<void> {
  try {
    if (isWindows) {
      await waitForProcessOutput("powershell", ["start", "", url])
    } else {
      try { await waitForProcessOutput("xdg-open", [url]); return; } catch (e) { }
      try { await waitForProcessOutput("gio", ["open", url]); return; } catch (e) { }
      try { await waitForProcessOutput("kde-open", [url]); return; } catch (e) { }
      try { await waitForProcessOutput("gnome-open", [url]); return; } catch (e) { }
      throw new Error("None of the methods worked .-.")
    }
  } catch (err) {
    console.error(err);
    vscode.window.showInformationMessage(`Please go to this URL: ${url}`);
  }
}

async function ensureSupportedPlatform() {
  if (!isUnix && !isWindows) {
    vscode.window.showInformationMessage(`Unsupported platform ${PLATFORM} - TODO!`);
    throw new Error("Nope");
  }
}

interface SSHVersion {
  major: number;
  minor: number;
}

function mkSSHVersion(major: number, minor: number): SSHVersion {
  return { major, minor };
}

function sshVersionCmp(a: SSHVersion, b: SSHVersion): number {
  const major = a.major - b.major;
  const minor = a.minor - b.minor;
  return major === 0 ? minor : major
}

interface SSHClient {
  vendor: SSH_VENDOR,
  fullVersionString: string,
  version: SSHVersion
}

// Set of constraints on the SSH client version
interface SSHVersionConstraints {
  // When a specific version is borked
  blacklist: SSHVersion[],
  // The minimum SSH version
  minimumVersion: SSHVersion,
}

interface SSHVersionSpec {
  // Hard limits - If we don't bail out NOW then we will leave the host in a broken state requiring manual intervention!!!
  // For ex. After the extension activates ssh won't be able to parse the ssh config
  hard?: SSHVersionConstraints,
  // Soft limits - Nothing is permamentelly borked but u may have an degraded experience
  // For ex. SSH agent forwarding is borked
  soft?: SSHVersionConstraints,
}

// TODO: Setting up an weekly E2E test pipeline for testing the compatibility would be amazing >.<
const REQUIRED_SSH_VERSION: Record<SSH_VENDOR, SSHVersionSpec> = {
  [SSH_VENDOR.OPENSSH_FOR_WINDOWS]: {
    // What I tested manually ¯\_(ツ)_/¯ 
    // 9.2.0.0, 9.1.0.0, 8.9.1.0 works out of the box
    // 8.6.0.0 connected but the agent forwading was borked
    // TODO: Test manually 8.9.0.0, 8.1.0.0, 8.0.0.0, 7.9.0.0, 7.7.2.0, 7.7.1.0, 7.7.0.0, 7.6.1.0, 7.6.0.1, 7.6.0.0
    hard: {
      blacklist: [],
      minimumVersion: mkSSHVersion(7, 6)
    },
    // Some OpenSSH_for_Windows versions get borked when the agent receives a request for the SSH agent restriction extension .-.
    // You may connect to a workspace but agent forwarding won't work
    // What is sad that Windows by default ships in their dev VM's 8.6 .-.
    soft: {
      blacklist: [],
      minimumVersion: mkSSHVersion(8, 9),
    }
  },
  // Include and ProxyJump are only supported from OpenSSH 7.3 released August 01, 2016
  [SSH_VENDOR.GIT_FOR_WINDOWS]: {
    hard: {
      minimumVersion: mkSSHVersion(7, 3),
      blacklist: [],
    }
  },
  [SSH_VENDOR.CORE_PORTABLE]: {
    hard: {
      minimumVersion: mkSSHVersion(7, 3),
      blacklist: [],
    }
  }
};

// Checks the output of ssh -V
// Detects if the ssh binary exits and we may execute it :)
async function discoverSshClientVersionString(): Promise<string> {
  try {
    return (await waitForProcessOutput("ssh", ["-V"])).stderr;
  } catch (err) {
    // Ok the binary was not found - Assume SSH Client is not available
    if ((err as any).code === "ENOENT") {
      const opt1 = "How to install it?"
      const opt2 = "But I have it installed";
      // Delibrate floating promise
      void vscode.window.showErrorMessage(`SSH client not found. Please install OpenSSH`, { modal: true }, opt1, opt2).then(async (v) => {
        if (v === opt1) {
          if (isWindows) {
            await tryOpenUrlInBrowser(WINDOWS_SSH_INSTALL_URL)
          } else {
            await vscode.window.showInformationMessage("Ubuntu/Debian: sudo apt-get install openssh-client\nArch/Manjaro: sudo pacman -S openssh", { modal: true });
          }
        } else if (v === opt2) {
          await tryOpenUrlInBrowser(BUG_REPORT_URL);
        }
      });
      throw Error("SSH Client not found")
    }
    // The SSH client exists but we got a generic error while probing the SSH version
    // It's best to assume that we can't use this SSH client, for ex we don't have perms for executing the ssh binary
    else {
      console.error(err)
      const opt1 = "Bug report";
      // Delibrate floating promise
      void vscode.window.showErrorMessage(`Unable to probe the SSH version`, { modal: true, detail: (err as Error).toString() }, opt1).then(async (v) => {
        if (v === opt1) {
          await tryOpenUrlInBrowser(BUG_REPORT_URL);
        }
      });
      throw Error("Failed to retrieve the SSH version")
    }
  }
}

// Detects as much info about the SSH Client as possible
// This may fail if the version slug is something very very very weird...
// Like imagine BigCorp having their own build with their company name in the version slug .-.
async function detectSshClient(): Promise<SSHClient> {
  // Example version strings:
  // ssh -V
  // Archlinux:        OpenSSH_9.2p1, OpenSSL 3.0.8 7 Feb 2023
  // Windows Git Bash: OpenSSH_9.2p1, OpenSSL 1.1.1t  7 Feb 2023
  // Windows:          OpenSSH_for_Windows_9.2p1, LibreSSL 3.6.1
  // Windows:          OpenSSH_for_Windows_8.6p1, LibreSSL 3.4.3
  const sshVersionString = await discoverSshClientVersionString();

  const matches = [...sshVersionString.matchAll(/(?<slug>OpenSSH_|OpenSSH_for_Windows_)(?<major>[0-9]+)\.(?<minor>[0-9]+)/ig)];
  if (matches.length !== 1) {
    const opt1 = "Bug report";
    // Delibrate floating promise
    void vscode.window.showErrorMessage(`Unable to parse the SSH version slug`, { modal: true, detail: `Please send us this string:\n${sshVersionString}` }, opt1).then(async (v) => {
      if (v === opt1) {
        await tryOpenUrlInBrowser(BUG_REPORT_URL);
      }
    });
    throw Error("Failed to parse the SSH version slug")
  }
  const slug: string = (matches[0].groups as any).slug;
  const sshVersion = mkSSHVersion(+(matches[0].groups as any).major, +(matches[0].groups as any).minor);

  // By default assume it's the official portable version
  let vendor: SSH_VENDOR = SSH_VENDOR.CORE_PORTABLE;
  // This slug may mean only one thing
  if (slug === "OpenSSH_for_Windows_") vendor = SSH_VENDOR.OPENSSH_FOR_WINDOWS;
  // Perhaps we have GIT_FOR_WINDOWS ?
  if (isWindows && vendor === SSH_VENDOR.CORE_PORTABLE) {
    vendor = SSH_VENDOR.GIT_FOR_WINDOWS;

    // If the next probe fails then assume we're runing GIT_FOR_WINDOWS
    // We need more probes cause OPENSSH_FOR_WINDOWS didn't always use "OpenSSH_for_Windows_" for the slug .-.
    try {
      // This resolves the absolute path to the ssh binary.
      const path = (await waitForProcessOutput("powershell", ["get-command ssh | Select -ExpandProperty Source"])).stdout;
      console.log(`SSH binary path: ${path}`)
      if (path.includes("\\usr\\bin\\")) {
        console.log("Looks like Git for Windows")
        vendor = SSH_VENDOR.GIT_FOR_WINDOWS
      }
      if (path.includes("\\OpenSSH\\")) {
        console.log("Looks like OpenSSH for Windows")
        vendor = SSH_VENDOR.OPENSSH_FOR_WINDOWS
      }
    } catch (e) { console.error(e) }
  }

  return {
    vendor,
    fullVersionString: sshVersionString,
    version: sshVersion
  }
}

async function ensureSshNewEnough(sshClient: SSHClient): Promise<void> {
  const versionRequirements = REQUIRED_SSH_VERSION[sshClient.vendor];
  // Check hard requirements
  if (versionRequirements.hard !== void 0) {
    const constraints = versionRequirements.hard;
    if (sshVersionCmp(constraints.minimumVersion, sshClient.version) > 0 || constraints.blacklist.find((x) => sshVersionCmp(x, sshClient.version) === 0) !== void 0) {
      const opt1 = "How to upgrade?";
      // Delibrate floating promise
      void vscode.window.showErrorMessage(`Unsupported SSH version :(`, { modal: true, detail: `Continuing with\n${sshClient.fullVersionString}would break the system, Aborting\nPlease upgrade to at least OpenSSH ${constraints.minimumVersion.major}.${constraints.minimumVersion.minor} in order to use Hocus` }, opt1).then(async (v) => {
        if (v === opt1) {
          await tryOpenUrlInBrowser(SSH_VENDOR_UPGRADE_LINK[sshClient.vendor]);
        }
      });
      throw new Error("Unsupported SSH version");
    }
  }
  // Check soft requirements
  if (versionRequirements.soft !== void 0) {
    const constraints = versionRequirements.soft;
    if (sshVersionCmp(constraints.minimumVersion, sshClient.version) > 0 || constraints.blacklist.find((x) => sshVersionCmp(x, sshClient.version) === 0) !== void 0) {
      const opt1 = "How to upgrade?";
      const opt2 = "I want to continue"
      const r = await vscode.window.showWarningMessage(`SSH client might be buggy`, { modal: true, detail: `Continuing with\n${sshClient.fullVersionString}might cause issues\nIf continuing expect that some Hocus features won't work\nIn order to get the full Hocus experience please upgrade to at least OpenSSH ${constraints.minimumVersion.major}.${constraints.minimumVersion.minor}\nDo you want to continue with a possibly buggy experience?` }, opt1, opt2)
      if (r === opt1) {
        await tryOpenUrlInBrowser(SSH_VENDOR_UPGRADE_LINK[sshClient.vendor]);
      } else if (r === opt2) {
        vscode.window.showInformationMessage(`Continuing with possibly buggy SSH`);
        return;
      }
      throw new Error("Unsupported SSH version");
    }
  }
}

// Checks if the SSH agent is available on the machine
// If not then tells you how to set it up
async function checkSSHAgentIsAvailable(sshClient: SSHClient): Promise<void> {
  let agentAvailable = false
  if (sshClient.vendor === SSH_VENDOR.CORE_PORTABLE || sshClient.vendor === SSH_VENDOR.GIT_FOR_WINDOWS) {
    if (process.env.SSH_AUTH_SOCK !== void 0) {
      agentAvailable = true;
    }
  }
  else if (sshClient.vendor === SSH_VENDOR.OPENSSH_FOR_WINDOWS) {
    // The ssh agent is a global windows service
    const serviceStatus = (await waitForProcessOutput("powershell", ["Get-Service ssh-agent | Select -ExpandProperty Status"])).stdout;
    if (serviceStatus.includes("Running")) {
      agentAvailable = true;
    }
  }

  if (!agentAvailable) {
    const opt1 = "How to fix this?";
    const opt2 = "Proceed anyway!";
    const r = await vscode.window.showWarningMessage("SSH Agent is not running", { modal: true, detail: "You may still connect to workspaces but you won't be able to push changes!\nDo you want to proceed anyway?" }, opt1, opt2);
    if (r === opt1) {
      await tryOpenUrlInBrowser(SSH_VENDOR_SETUP_AGENT_LINK[sshClient.vendor]);
      await vscode.window.showInformationMessage("Remember to FULLY restart Vscode after starting the ssh-agent! Also restart the terminal you used to launch Vscode with :)", { modal: true })
    } else if (r === opt2) {
      vscode.window.showInformationMessage(`Continuing without SSH Agent`);
      return;
    }
    throw new Error("SSH Agent not available")
  }
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
  // Assume the Client won't get upgraded while vscode is running :)
  const sshClient = await detectSshClient();
  await ensureSshNewEnough(sshClient);
  await checkSSHAgentIsAvailable(sshClient);
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

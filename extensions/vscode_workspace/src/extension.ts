import * as fs from "fs-extra";
import * as glob from "glob";
import * as os from "os";
import * as vscode from "vscode";

const HOCUS_DIR = "/home/hocus/dev/.hocus";
const HOCUS_WORKSPACE_TASKS_DIR = `${HOCUS_DIR}/command`

export async function isHocusWorkspace(): Promise<boolean> {
  // No need to probe if running in the web or locally
  if (vscode.env.remoteName === void 0 || vscode.env.uiKind !== vscode.UIKind.Desktop) {
    return false;
  }

  // Assume that if this magic folder exists and we're on linux then we're in a Hocus workspace
  const platform = os.platform();
  return platform === "linux" && await fs.exists(HOCUS_DIR);
}

interface WorkspaceTask {
  taskIdx: number;
  taskName: string,
  attachScriptPath: string,
  running: boolean,
}

export async function scanWorkspaceTasks(): Promise<WorkspaceTask[]> {
  const tasks: WorkspaceTask[] = [];
  for (const attachScriptPath of await glob.glob("attach-*.sh", { absolute: true, follow: false, cwd: HOCUS_WORKSPACE_TASKS_DIR, nodir: true })) {
    const taskIdx = +attachScriptPath.split("attach-")[1].slice(0, -3);
    tasks.push({
      taskIdx,
      taskName: `Task ${taskIdx + 1}`,
      attachScriptPath,
      running: await fs.exists(attachScriptPath.replace("attach-", "task-").slice(0, -3) + ".sock")
    })
  }
  return tasks;
}

export function attachVscodeTerminalToTask(task: WorkspaceTask): vscode.Terminal {
  // TODO: Add an icon for the terminal
  return vscode.window.createTerminal(
    { name: task.taskName, shellPath: task.attachScriptPath }
  );
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("Hocus Workspace Activated");

  const isWorkspace = await isHocusWorkspace();
  vscode.commands.executeCommand('setContext', 'hocus-remote.isHocusWorkspace', isWorkspace);
  if (!isWorkspace) {
    console.log("Not inside a hocus workspace");
    return;
  }

  for (const task of await scanWorkspaceTasks()) {
    if (!task.running) continue;
    attachVscodeTerminalToTask(task);
  }

  vscode.window.onDidCloseTerminal(async (e) => {
    if ((e.creationOptions as any).shellPath === void 0) return;
    const creationOptions = e.creationOptions as vscode.TerminalOptions;

    const tasks = await scanWorkspaceTasks();
    const taskState = tasks.find((task) => task.attachScriptPath === creationOptions.shellPath)

    if (taskState === void 0) return;

    if (taskState.running) {
      // TODO: Ask the user whether to kill the terminal
      // TODO: If the user agrees then we would need to find the terminal process and shot it with SIGKILL
      vscode.window.showInformationMessage("The terminal you closed is still running in the background. Reload the window to bring it back up.")
    }
  })
}

export function deactivate() {
  console.log("Hocus Workspace Deactivated");
}

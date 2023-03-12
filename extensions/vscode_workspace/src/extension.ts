import * as fs from "fs-extra";
import * as glob from "glob";
import * as os from "os";
import * as vscode from "vscode";
import * as yaml from "yaml";
import { ProjectConfigValidator } from "./project-config/validator";

const HOCUS_DIR = "/home/hocus/dev/.hocus";
const HOCUS_WORKSPACE_TASKS_DIR = `${HOCUS_DIR}/command`
const HOCUS_CONFIG_PATH = `${HOCUS_DIR}/workspace-config.yml`

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

export class GroupError extends Error {
  constructor(public readonly errors: unknown[]) {
    super(
      `Group error: ${errors
        .map((e) => (e instanceof Error ? e.message : `unknown error: ${String(e)}`))
        .join(", ")}`,
    );
  }
}

/**
 * Works like `Promise.allSettled` but throws an error if any of the promises fail.
 */
export const waitForPromises = async <T>(promises: Iterable<T>): Promise<Awaited<T>[]> => {
  const results = await Promise.allSettled(promises);
  const errors = results
    .filter((result) => result.status === "rejected")
    .map((result) => {
      const reason = (result as PromiseRejectedResult).reason;
      if (reason instanceof Error) {
        return reason;
      }
      return new Error(String(reason));
    });
  if (errors.length > 0) {
    throw new GroupError(errors);
  }

  return results.map((result) => (result as PromiseFulfilledResult<Awaited<T>>).value);
};

export async function activate(context: vscode.ExtensionContext) {
  console.log("Hocus Workspace Activated");

  const isWorkspace = await isHocusWorkspace();
  vscode.commands.executeCommand('setContext', 'hocus-remote.isHocusWorkspace', isWorkspace);
  if (!isWorkspace) {
    console.log("Not inside a hocus workspace");
    return;
  }

  // Ensure extensions from the workspace config are installed
  const workspaceConfig = ProjectConfigValidator.SafeParse(yaml.parse(await fs.readFile(HOCUS_CONFIG_PATH, "utf-8")));
  if (!workspaceConfig.success) {
    vscode.window.showInformationMessage("Syntax error in workspace configuration");
    console.log(workspaceConfig);
    console.error(workspaceConfig.error);
  } else {
    if (workspaceConfig.value.vscode) {
      try {
        await waitForPromises(workspaceConfig.value.vscode.extensions.map((extName) => vscode.commands.executeCommand("workbench.extensions.installExtension", extName)));
      } catch (e) {
        console.error(e);
      }
    }
  }

  for (const task of await scanWorkspaceTasks()) {
    if (!task.running) { continue; }
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

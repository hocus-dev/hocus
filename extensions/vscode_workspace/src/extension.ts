import * as child_process from "child_process";
import * as fs from "fs-extra";
import * as glob from "glob";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import * as yaml from "yaml";
import { ProjectConfigValidator } from "./project-config/validator";

const HOCUS_DIR = "/home/hocus/dev/.hocus";
const HOCUS_WORKSPACE_TASKS_DIR = `${HOCUS_DIR}/command`
const HOCUS_CONFIG_PATH = `${HOCUS_DIR}/workspace-config.yml`

async function isHocusWorkspace(): Promise<boolean> {
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

async function scanWorkspaceTasks(): Promise<WorkspaceTask[]> {
  const tasks: WorkspaceTask[] = [];
  for (const attachScriptPath of await glob.glob("attach-*.sh", { absolute: true, follow: false, cwd: HOCUS_WORKSPACE_TASKS_DIR, nodir: true })) {
    const taskIdx = +attachScriptPath.split("attach-")[1].slice(0, -3);
    tasks.push({
      taskIdx,
      taskName: `Task ${taskIdx + 1}`,
      attachScriptPath,
      running: await fs.exists(attachScriptPath.replace("attach-", "task-").slice(0, -3) + ".sock")
    });
  }
  return tasks.reverse();
}

function attachVscodeTerminalToTask(task: WorkspaceTask): vscode.Terminal {
  // TODO: Add an icon for the terminal
  return vscode.window.createTerminal(
    { name: task.taskName, shellPath: task.attachScriptPath }
  );
}

// Turns out term.creationOptions is very unreliable. The info is lost after a window reload
// What is preserved is the PID of the terminal. Use it to read from /proc directly :)
// BBQ Driven Developement here we come :)
async function getTerminalCmdLine(term: vscode.Terminal): Promise<string | undefined> {
  const pid = await term.processId;
  return (await fs.readFile(`/proc/${pid}/cmdline`, "utf-8")).split('\x00')[1];
}
class GroupError extends Error {
  constructor(public readonly errors: unknown[]) {
    super(
      `Group error: ${errors
        .map((e) => (e instanceof Error ? e.message : `unknown error: ${String(e)}`))
        .join(", ")}`,
    );
  }
}

//TODO: This emits the wrong type for tuples .-.
/**
 * Works like `Promise.allSettled` but throws an error if any of the promises fail.
 */
const waitForPromises = async <T>(promises: Iterable<T>): Promise<Awaited<T>[]> => {
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

async function getVSCodeProductJson() {
  const productJsonStr = await fs.promises.readFile(path.join(vscode.env.appRoot, 'product.json'), 'utf8');
  return JSON.parse(productJsonStr);
}

async function setupExtensions(): Promise<void> {
  // Ensure extensions from the workspace config are installed
  try {
    const workspaceConfig = ProjectConfigValidator.SafeParse(yaml.parse(await fs.readFile(HOCUS_CONFIG_PATH, "utf-8")));
    if (!workspaceConfig.success) {
      vscode.window.showInformationMessage("Syntax error in workspace configuration");
      console.log(workspaceConfig);
      console.error(workspaceConfig.error);
    } else {
      if (workspaceConfig.value.vscode) {
        try {
          const productJson = await getVSCodeProductJson();
          const binaryName = productJson.applicationName || 'code';
          const cliPath = path.join(vscode.env.appRoot, "bin/remote-cli", binaryName);
          const args = workspaceConfig.value.vscode.extensions.flatMap(e => ['--install-extension', e]);

          const cp = child_process.spawn(cliPath, args, { timeout: 30_000, stdio: "ignore" });
          await new Promise((resolve, reject) => {
            cp.on("error", (err) => reject(err));
            cp.on("exit", resolve);
            cp.on("close", resolve);
            cp.on("disconnect", resolve);
          });

        } catch (e) {
          console.error(e);
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}

async function setupTerminals(): Promise<void> {
  const [alreadyOpened, tasks] = await Promise.all([
    waitForPromises(vscode.window.terminals.map((term) => getTerminalCmdLine(term))),
    scanWorkspaceTasks()
  ] as const);
  for (const task of tasks) {
    if (!task.running || alreadyOpened.includes(task.attachScriptPath)) { continue; }
    const term = attachVscodeTerminalToTask(task);
    term.show(false);
  }

  vscode.window.onDidCloseTerminal(async (term) => {
    const [cmdLine, tasks] = await Promise.all([getTerminalCmdLine(term), scanWorkspaceTasks()]);
    const taskState = tasks.find((task) => task.attachScriptPath === cmdLine);

    if (taskState === void 0) { return; }

    if (taskState.running) {
      // TODO: Ask the user whether to kill the terminal
      // TODO: If the user agrees then we would need to find the terminal process and shot it with SIGKILL
      vscode.window.showInformationMessage("The terminal you closed is still running in the background. Reload the window to bring it back up.")
    }
  });
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("Hocus Workspace started activation");

  const isWorkspace = await isHocusWorkspace();
  vscode.commands.executeCommand('setContext', 'hocus-remote.isHocusWorkspace', isWorkspace);
  if (!isWorkspace) {
    console.log("Not inside a hocus workspace");
    return;
  }

  await waitForPromises([
    setupExtensions(),
    setupTerminals(),
  ]);

  console.log("Hocus Workspace finished activation");
}

export function deactivate() {
  console.log("Hocus Workspace Deactivated");
}

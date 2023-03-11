import path from "path";

import { v4 as uuidv4 } from "uuid";
import { execSshCmd } from "~/agent/utils";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import type { VMTaskOutput } from "../agent-util.types";
import { SOLO_AGENT_INSTANCE_ID, WORKSPACE_ENV_SCRIPT_PATH } from "../constants";

import type { CreateActivity } from "./types";

export type PrebuildActivity = (args: { prebuildEventId: bigint }) => Promise<VMTaskOutput[]>;
/**
 * Returns the result for every task.
 *
 * Assumes that there is a `hocus` user with passwordless sudo on the
 * filesystem drive, sshd is configured to start running automatically after VM boot,
 * and the corresponding public key to the private key used to connect to the VM
 * (`agentConfig.prebuildSshPrivateKey`) is already present in the `hocus` user's authorized_keys.
 */
export const prebuild: CreateActivity<PrebuildActivity> =
  ({ injector, db }) =>
  async (args) => {
    const runId = uuidv4();
    const instanceId = `prebuild-${runId}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const prebuildService = injector.resolve(Token.PrebuildService);
    const agentConfig = injector.resolve(Token.Config).agent();

    const prebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
      where: { id: args.prebuildEventId },
      include: {
        tasks: { include: { vmTask: true } },
        prebuildEventFiles: { include: { agentInstance: true, fsFile: true, projectFile: true } },
        project: {
          include: {
            environmentVariableSet: {
              include: {
                environmentVariables: true,
              },
            },
          },
        },
      },
    });
    const prebuildEventFiles = unwrap(
      prebuildEvent.prebuildEventFiles.find(
        (f) => f.agentInstance.externalId === SOLO_AGENT_INSTANCE_ID,
      ),
    );
    const envVariables = prebuildEvent.project.environmentVariableSet.environmentVariables.map(
      (v) => ({
        name: v.name,
        value: v.value,
      }),
    );
    const tasks = prebuildEvent.tasks;
    return await firecrackerService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: agentConfig.defaultKernel,
        rootFsPath: prebuildEventFiles.fsFile.path,
        extraDrives: [
          {
            pathOnHost: prebuildEventFiles.projectFile.path,
            guestMountPath: prebuildService.devDir,
          },
        ],
      },
      async ({ ssh, sshConfig }) => {
        const envScript = agentUtilService.generateEnvVarsScript(envVariables);
        await execSshCmd({ ssh }, ["mkdir", "-p", path.dirname(WORKSPACE_ENV_SCRIPT_PATH)]);
        await agentUtilService.writeFile(ssh, WORKSPACE_ENV_SCRIPT_PATH, envScript);
        await Promise.all(
          tasks.map(async (task) => {
            const script = agentUtilService.generatePrebuildTaskScript(task.originalCommand);
            const paths = prebuildService.getPrebuildTaskPaths(task.idx);
            await execSshCmd({ ssh }, ["mkdir", "-p", prebuildService.prebuildScriptsDir]);
            await agentUtilService.writeFile(ssh, paths.scriptPath, script);
          }),
        );

        return await agentUtilService.execVmTasks(
          sshConfig,
          db,
          tasks.map((t) => ({
            vmTaskId: t.vmTask.id,
          })),
        );
      },
    );
  };

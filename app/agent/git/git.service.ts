import fs from "fs/promises";
import path from "path";

import type { GitBranch, GitObject, GitRepositoryImage, LocalOciImage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Logger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import type { AgentUtilService } from "../agent-util.service";
import { BlockRegistryService } from "../block-registry/registry.service";
import { PROJECT_DIR } from "../constants";
import type { HocusRuntime } from "../runtime/hocus-runtime";
import {
  LocalLockNamespace,
  execCmdWithOpts,
  execSshCmd,
  withLocalLock,
  withRuntimeAndImages,
} from "../utils";

import { RemoteInfoTupleValidator } from "./validator";

import type { Config } from "~/config";
import type { ValidationError } from "~/schema/utils.server";
import { Token } from "~/token";
import { sha256 } from "~/utils.server";
import { displayError, unwrap, waitForPromises } from "~/utils.shared";

export interface GitRemoteInfo {
  /** The name of the remote, e.g. `refs/heads/master` */
  name: string;
  /** The hash of the object the remote is pointing to, in other words
   * commit hash. E.g. `8e5423e991e8cd0988d0c4a3f4ac4ca1af7d148a` */
  hash: string;
}

interface ParseError {
  error: ValidationError;
  value: string;
}

interface RemoteUpdate {
  state: "new" | "updated" | "deleted";
  remoteInfo: GitRemoteInfo;
}

export interface UpdateBranchesResult {
  newGitBranches: (GitBranch & {
    gitObject: GitObject;
  })[];
  updatedGitBranches: (GitBranch & {
    gitObject: GitObject;
  })[];
}

export class AgentGitService {
  static inject = [
    Token.Logger,
    Token.AgentUtilService,
    Token.BlockRegistryService,
    Token.Config,
  ] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;
  private readonly branchRefRegex = /^refs\/heads\/(.+)$/;

  constructor(
    private readonly logger: Logger,
    private readonly agentUtilService: AgentUtilService,
    private readonly blockRegistryService: BlockRegistryService,
    config: Config,
  ) {
    this.agentConfig = config.agent();
  }

  private parseLsRemoteOutput(output: string): {
    remotes: GitRemoteInfo[];
    errors: ParseError[];
  } {
    const remotes: GitRemoteInfo[] = [];
    const errors: ParseError[] = [];

    output
      .toString()
      .split("\n")
      .filter((line) => line.length > 0)
      .forEach((line) => {
        const words = line.split(/\s/);
        const result = RemoteInfoTupleValidator.SafeParse(words);
        if (result.success) {
          const value = result.value;
          remotes.push({ hash: value[0], name: value[1] });
        } else {
          errors.push({ error: result.error, value: line });
        }
      });

    return { remotes, errors };
  }

  private async writeKey(pathToPrivateKey: string, key: string): Promise<void> {
    const contents = key.endsWith("\n") ? key : `${key}\n`;
    await fs.writeFile(pathToPrivateKey, contents);
    await fs.chmod(pathToPrivateKey, 0o600);
  }

  /**
   * Even if the repository is public, we still need to provide a private key.
   * This is because many providers (GitHub in particular) will reject SSH
   * connections that don't use a private key.
   *
   * This private key must be added to GitHub somewhere. It can be added to a
   * different account than the one that owns the repository. Or it can even
   * be a deploy key for a different repository. But GitHub must know
   * that it exists, otherwise it will reject the connection.
   */
  async getRemotes(repositoryUrl: string, privateKey: string): Promise<GitRemoteInfo[]> {
    const pathToPrivateKey = `/tmp/${uuidv4()}.key`;
    try {
      await this.writeKey(pathToPrivateKey, privateKey);
      const output = await execCmdWithOpts(["git", "ls-remote", repositoryUrl], {
        // TODO: allow the user to specify a known_hosts file.
        env: { GIT_SSH_COMMAND: `ssh -i "${pathToPrivateKey}" -o StrictHostKeyChecking=no` },
      });
      const result = this.parseLsRemoteOutput(output.stdout.toString());
      for (const { error, value } of result.errors) {
        this.logger.error(
          `Failed to parse git ls-remote output:\n${error.message}\nOffending value: "${value}"`,
        );
      }
      return result.remotes;
    } finally {
      await fs.unlink(pathToPrivateKey).catch((err) => {
        this.logger.warn(
          `Failed to delete private key file ${pathToPrivateKey}\n${displayError(err)})}`,
        );
      });
    }
  }

  async findRemoteUpdates(
    oldRemotes: GitRemoteInfo[],
    newRemotes: GitRemoteInfo[],
  ): Promise<RemoteUpdate[]> {
    const oldRemotesMap = new Map(oldRemotes.map((r) => [r.name, r.hash]));
    const updatedRemotes: RemoteUpdate[] = [];
    const accessedRemotes = new Set<string>();
    for (const remote of newRemotes) {
      accessedRemotes.add(remote.name);
      const oldHash = oldRemotesMap.get(remote.name);
      if (oldHash !== remote.hash) {
        updatedRemotes.push({ remoteInfo: remote, state: oldHash != null ? "updated" : "new" });
      }
    }
    for (const remote of oldRemotes) {
      if (!accessedRemotes.has(remote.name)) {
        updatedRemotes.push({ remoteInfo: remote, state: "deleted" });
      }
    }
    return updatedRemotes;
  }

  async updateBranches(
    db: Prisma.NonTransactionClient,
    gitRepositoryId: bigint,
  ): Promise<UpdateBranchesResult> {
    const getGitRepo = (innerDb: Prisma.Client) =>
      innerDb.gitRepository.findUniqueOrThrow({
        where: { id: gitRepositoryId },
        include: {
          sshKeyPair: true,
          gitBranches: {
            include: {
              gitObject: true,
            },
          },
        },
      });
    let gitRepository = await getGitRepo(db);
    const newRemotes = await this.getRemotes(
      gitRepository.url,
      gitRepository.sshKeyPair.privateKey,
    ).then((rs) => rs.filter((remote) => this.branchRefRegex.test(remote.name)));
    return await db.$transaction(async (tdb) => {
      await tdb.$executeRaw`SELECT id FROM "GitRepository" WHERE id = ${gitRepositoryId} FOR UPDATE`;
      gitRepository = await getGitRepo(tdb);
      const currentRemotes: GitRemoteInfo[] = gitRepository.gitBranches.map((b) => ({
        name: b.name,
        hash: b.gitObject.hash,
      }));
      const remoteUpdates = await this.findRemoteUpdates(currentRemotes, newRemotes);
      const newBranches = remoteUpdates.filter((u) => u.state === "new");
      const updatedBranches = remoteUpdates.filter((u) => u.state === "updated");
      const allBranches = [...newBranches, ...updatedBranches];
      const hashes = Array.from(new Set(allBranches.map((b) => b.remoteInfo.hash)));
      const gitObjects = await waitForPromises(
        hashes.map((hash) =>
          tdb.gitObject.upsert({
            create: {
              hash,
            },
            update: {},
            where: {
              hash,
            },
          }),
        ),
      );
      const gitObjectMap = new Map(gitObjects.map((o) => [o.hash, o]));
      const newGitBranches = await waitForPromises(
        newBranches.map((b) =>
          tdb.gitBranch.create({
            data: {
              name: b.remoteInfo.name,
              gitRepositoryId,
              gitObjectId: unwrap(gitObjectMap.get(b.remoteInfo.hash)).id,
            },
            include: {
              gitObject: true,
            },
          }),
        ),
      );
      const updatedGitBranches = await waitForPromises(
        updatedBranches.map((b) =>
          tdb.gitBranch.update({
            // eslint-disable-next-line camelcase
            where: { gitRepositoryId_name: { gitRepositoryId, name: b.remoteInfo.name } },
            data: {
              gitObjectId: unwrap(gitObjectMap.get(b.remoteInfo.hash)).id,
            },
            include: {
              gitObject: true,
            },
          }),
        ),
      );
      await waitForPromises(
        allBranches.map(async (b) => {
          const existing = await tdb.gitObjectToBranch.findFirst({
            where: {
              gitBranch: {
                gitRepositoryId,
                name: b.remoteInfo.name,
              },
              gitObject: {
                hash: b.remoteInfo.hash,
              },
            },
          });
          if (existing != null) {
            return;
          }
          await tdb.gitObjectToBranch.create({
            data: {
              gitBranch: {
                connect: {
                  // eslint-disable-next-line camelcase
                  gitRepositoryId_name: { gitRepositoryId, name: b.remoteInfo.name },
                },
              },
              gitObject: {
                connect: {
                  hash: b.remoteInfo.hash,
                },
              },
            },
          });
        }),
      );
      if (newGitBranches.length + updatedGitBranches.length > 0) {
        await tdb.gitRepository.update({
          where: { id: gitRepositoryId },
          data: {
            lastBranchUpdateAt: new Date(),
          },
        });
      }
      return { newGitBranches, updatedGitBranches };
    });
  }

  async fetchRepository(args: {
    runtime: HocusRuntime;
    /** A container with the fetched repository will be created from this */
    outputId: string;
    /** Every temporary image and container id will use this prefix. Used for garbage collection. */
    tmpContentPrefix: string;
    repository: {
      url: string;
      credentials: {
        /**
         * The contents of the private SSH key, e.g.:
         * ```
         * -----BEGIN OPENSSH PRIVATE KEY-----
         * b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
         * ...
         * -----END OPENSSH PRIVATE KEY-----
         * ```
         * Keep in mind that a newline at the end of the key is required.
         */
        privateSshKey: string;
      };
    };
  }): Promise<void> {
    const { runtime, outputId, repository, tmpContentPrefix } = args;
    const localRootFsImageTag = `fetchrepo-${sha256(this.agentConfig.fetchRepoImageTag)}`;
    const rootFsImageId = BlockRegistryService.genImageId(localRootFsImageTag);
    if (!(await this.blockRegistryService.hasContent(rootFsImageId))) {
      await this.blockRegistryService.loadImageFromRemoteRepo(
        this.agentConfig.fetchRepoImageTag,
        localRootFsImageTag,
      );
    }
    const rootFsContainerId = await this.blockRegistryService.createContainer(
      rootFsImageId,
      `${tmpContentPrefix}-fetchrepo-${uuidv4()}`,
    );
    const containerId = BlockRegistryService.genContainerId(outputId);
    return await withLocalLock(LocalLockNamespace.CONTAINER, containerId, async () => {
      await this.blockRegistryService.createContainer(void 0, outputId, {
        mkfs: true,
        sizeInGB: 64,
      });
      const outputDir = "/fr";
      await withRuntimeAndImages(
        this.blockRegistryService,
        runtime,
        {
          ssh: {
            username: "hocus",
            password: "hocus",
          },
          kernelPath: this.agentConfig.defaultKernel,
          fs: {
            "/": rootFsContainerId,
            [outputDir]: containerId,
          },
          memSizeMib: 1024,
          vcpuCount: 1,
        },
        async ({ ssh }) => {
          const repositoryDir = path.join(outputDir, PROJECT_DIR);
          const outputDirOwner = await execSshCmd({ ssh }, [
            "sudo",
            "stat",
            "-c",
            "%U",
            outputDir,
          ]).then((r) => r.stdout.trim());
          if (outputDirOwner !== "hocus") {
            await execSshCmd({ ssh }, ["sudo", "chown", "-R", "hocus:hocus", outputDir]);
          }
          const sshKey = repository.credentials.privateSshKey;
          const sshDir = "/home/hocus/.ssh";
          const sshKeyPath = path.join(sshDir, `${uuidv4()}.key`);
          await execSshCmd({ ssh }, ["mkdir", "-p", sshDir]);
          await execSshCmd({ ssh }, ["sudo", "mount", "-t", "tmpfs", "ssh", sshDir]);
          await execSshCmd({ ssh }, ["sudo", "chown", "hocus:hocus", sshDir]);
          await execSshCmd({ ssh }, ["chmod", "700", sshDir]);
          await this.agentUtilService.writeFile(ssh, sshKeyPath, sshKey);
          await execSshCmd({ ssh }, ["chmod", "400", sshKeyPath]);

          const sshOpts = {
            execOptions: {
              env: {
                // Without this, git will ask for user input and the command will fail.
                // This is obviously not secure, the correct method would be to
                // TODO: allow the user to specify a known_hosts file.
                GIT_SSH_COMMAND: `ssh -i "${sshKeyPath}" -o  UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no`,
              } as any,
            },
          };

          const repositoryExists =
            (
              await execSshCmd({ ssh, allowNonZeroExitCode: true }, [
                "test",
                "-d",
                `${repositoryDir}/.git`,
              ])
            ).code === 0;
          if (repositoryExists) {
            await execSshCmd({ ssh, opts: { ...sshOpts, cwd: repositoryDir } }, [
              "git",
              "fetch",
              "--all",
            ]);
          } else {
            await execSshCmd(
              {
                ssh,
                opts: sshOpts,
              },
              ["git", "clone", "--no-checkout", repository.url, repositoryDir],
            );
          }

          // TODO: This is a PITA as LFS might span TB's of data .-. we need to revisit this in the future
          await execSshCmd({ ssh, opts: { ...sshOpts, cwd: repositoryDir } }, [
            "git",
            "lfs",
            "fetch",
            "--all",
          ]);
        },
      );
    });
  }

  async getOrCreateGitRepoImage(
    db: Prisma.TransactionClient,
    agentInstanceId: bigint,
    gitRepositoryId: bigint,
  ): Promise<
    GitRepositoryImage & {
      localOciImage: LocalOciImage;
    }
  > {
    let gitRepoImage = await db.gitRepositoryImage.findUnique({
      // eslint-disable-next-line camelcase
      where: { gitRepositoryId_agentInstanceId: { gitRepositoryId, agentInstanceId } },
      include: { localOciImage: true },
    });
    if (gitRepoImage != null) {
      return gitRepoImage;
    }

    await db.$executeRawUnsafe(
      `LOCK TABLE "${Prisma.ModelName.GitRepositoryImage}" IN SHARE UPDATE EXCLUSIVE MODE`,
    );

    gitRepoImage = await db.gitRepositoryImage.findUnique({
      // eslint-disable-next-line camelcase
      where: { gitRepositoryId_agentInstanceId: { gitRepositoryId, agentInstanceId } },
      include: { localOciImage: true },
    });
    if (gitRepoImage != null) {
      return gitRepoImage;
    }
    const repo = await db.gitRepository.findUniqueOrThrow({
      where: {
        id: gitRepositoryId,
      },
      select: {
        url: true,
      },
    });
    const imageTag = `repo-${sha256(repo.url)}`;
    return await db.gitRepositoryImage.create({
      data: {
        gitRepository: {
          connect: {
            id: gitRepositoryId,
          },
        },
        agentInstance: {
          connect: {
            id: agentInstanceId,
          },
        },
        imageAgentMatch: {},
        localOciImage: {
          create: {
            tag: imageTag,
            readonly: false,
            agentInstance: {
              connect: {
                id: agentInstanceId,
              },
            },
          },
        },
      },
      include: {
        localOciImage: true,
      },
    });
  }
}

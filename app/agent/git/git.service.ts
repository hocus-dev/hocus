import fs from "fs/promises";
import path from "path";

import type {
  GitBranch,
  GitObject,
  GitRepository,
  GitRepositoryFile,
  SshKeyPair,
  File,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";
import type { Logger } from "@temporalio/worker";
import sshpk from "sshpk";
import { v4 as uuidv4 } from "uuid";
import type { Config } from "~/config";
import type { ValidationError } from "~/schema/utils.server";
import { Token } from "~/token";
import { displayError, unwrap, waitForPromises } from "~/utils.shared";

import type { AgentUtilService } from "../agent-util.service";
import { HOST_PERSISTENT_DIR, PROJECT_DIR } from "../constants";
import type { FirecrackerService } from "../firecracker.service";
import { doesFileExist, execCmdWithOpts, execSshCmd } from "../utils";

import { GitUrlError } from "./error";
import { RemoteInfoTupleValidator } from "./validator";

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

export class GitService {
  static inject = [Token.Logger, Token.AgentUtilService, Token.Config] as const;
  private readonly agentConfig: ReturnType<Config["agent"]>;
  /**
   * Original source: https://github.com/jonschlinkert/is-git-url/blob/396965ffabf2f46656c8af4c47bef1d69f09292e/index.js#LL9C3-L9C88
   * Modified to disallow the `https` protocol.
   */
  private gitUrlRegex = /(?:git|ssh|git@[-\w.]+):(\/\/)?(.*?)(\.git)(\/?|#[-\d\w._]+?)$/;

  constructor(
    private readonly logger: Logger,
    private readonly agentUtilService: AgentUtilService,
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
   * be a deploy key for a diffrerent repository. But GitHub must know
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

  async isGitSshUrl(url: string): Promise<boolean> {
    return this.gitUrlRegex.test(url);
  }

  async generateSshKeyPair(db: Prisma.Client, type: SshKeyPairType): Promise<SshKeyPair> {
    const privateKey = await sshpk.generatePrivateKey("ed25519");
    const sshPrivateKey = privateKey.toString("ssh");
    return await this.createSshKeyPair(db, sshPrivateKey, type);
  }

  async createSshKeyPair(
    db: Prisma.Client,
    privateKey: string,
    type: SshKeyPairType,
  ): Promise<SshKeyPair> {
    const parsedPrivateKey = sshpk.parsePrivateKey(privateKey);
    const sshPrivateKey = parsedPrivateKey.toString("ssh");
    const sshPublicKey = parsedPrivateKey.toPublic().toString("ssh");

    return await db.sshKeyPair.create({
      data: {
        publicKey: sshPublicKey,
        privateKey: sshPrivateKey,
        type,
      },
    });
  }

  /**
   * If the server has a server-controlled SSH key pair, return it.
   * Otherwise, generate one and return it.
   * Note: this method will lock the SshKeyPair table if a key pair does not exist
   * until the transaction is complete.
   * No updates will be allowed to the table until the transaction is complete. You should
   * finish the transaction as soon as possible.
   */
  async getOrCreateServerControlledSshKeyPair(db: Prisma.TransactionClient): Promise<SshKeyPair> {
    const getKeyPair = () =>
      db.sshKeyPair.findFirst({
        where: { type: SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED },
      });
    let keyPair = await getKeyPair();
    if (keyPair) {
      return keyPair;
    }
    await db.$executeRawUnsafe(
      `LOCK TABLE "${Prisma.ModelName.SshKeyPair}" IN SHARE UPDATE EXCLUSIVE MODE`,
    );
    keyPair = await getKeyPair();
    if (keyPair) {
      return keyPair;
    }

    return await this.generateSshKeyPair(db, SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED);
  }

  async addGitRepository(
    db: Prisma.Client,
    repositoryUrl: string,
    sshKeyPairId: bigint,
  ): Promise<GitRepository> {
    if (!this.isGitSshUrl(repositoryUrl)) {
      throw new GitUrlError(`Invalid git repository URL: ${repositoryUrl}`);
    }
    const keyPair = await db.sshKeyPair.findUniqueOrThrow({ where: { id: sshKeyPairId } });
    if (keyPair.type !== SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED) {
      throw new Error(
        `Cannot add git repository with SSH key pair of type ${keyPair.type}. Expected ${SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED}`,
      );
    }

    return await db.gitRepository.create({
      data: {
        url: repositoryUrl,
        sshKeyPairId,
      },
    });
  }

  async updateBranches(
    db: Prisma.NonTransactionClient,
    gitRepositoryId: bigint,
  ): Promise<{
    newGitBranches: (GitBranch & {
      gitObject: GitObject;
    })[];
    updatedGitBranches: (GitBranch & {
      gitObject: GitObject;
    })[];
  }> {
    const gitRepository = await db.gitRepository.findUniqueOrThrow({
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
    const newRemotes = await this.getRemotes(
      gitRepository.url,
      gitRepository.sshKeyPair.privateKey,
    );
    return await db.$transaction(async (tdb) => {
      await tdb.$executeRaw`SELECT id FROM "GitRepository" WHERE id = ${gitRepositoryId} FOR UPDATE`;
      const currentRemotes: GitRemoteInfo[] = gitRepository.gitBranches.map((b) => ({
        name: b.name,
        hash: b.gitObject.hash,
      }));
      const remoteUpdates = await this.findRemoteUpdates(currentRemotes, newRemotes);
      const newBranches = remoteUpdates.filter((u) => u.state === "new");
      const updatedBranches = remoteUpdates.filter((u) => u.state === "updated");
      const hashes = Array.from(
        new Set([
          ...newBranches.map((b) => b.remoteInfo.hash),
          ...updatedBranches.map((b) => b.remoteInfo.hash),
        ]),
      );
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

  async fetchRepository(
    firecrackerService: FirecrackerService,
    outputDrive: {
      pathOnHost: string;
      maxSizeMiB: number;
    },
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
    },
  ): Promise<void> {
    const outputDriveExists = await doesFileExist(outputDrive.pathOnHost);
    if (!outputDriveExists) {
      await fs.mkdir(path.dirname(outputDrive.pathOnHost), { recursive: true });
      this.agentUtilService.createExt4Image(outputDrive.pathOnHost, outputDrive.maxSizeMiB);
      this.logger.info(`empty output image created at ${outputDrive.pathOnHost}`);
    }
    const outputDir = "/tmp/output";
    await firecrackerService.withVM(
      {
        ssh: {
          username: "hocus",
          password: "hocus",
        },
        kernelPath: this.agentConfig.defaultKernel,
        rootFsPath: this.agentConfig.fetchRepositoryRootFs,
        extraDrives: [
          {
            pathOnHost: outputDrive.pathOnHost,
            guestMountPath: outputDir,
          },
        ],
      },
      async ({ ssh }) => {
        const repositoryDir = path.join(outputDir, PROJECT_DIR);
        const logFilePath = "/tmp/ssh-fetchrepo.log";
        if (!outputDriveExists) {
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
          await execSshCmd({ ssh, logFilePath, opts: { ...sshOpts, cwd: repositoryDir } }, [
            "git",
            "fetch",
            "--all",
          ]);
        } else {
          await execSshCmd(
            {
              ssh,
              logFilePath,
              opts: sshOpts,
            },
            ["git", "clone", "--no-checkout", repository.url, repositoryDir],
          );
        }
      },
    );
  }

  async getOrCreateGitRepositoryFile(
    db: Prisma.TransactionClient,
    agentInstanceId: bigint,
    gitRepositoryId: bigint,
  ): Promise<
    GitRepositoryFile & {
      file: File;
    }
  > {
    let gitRepositoryFile = await db.gitRepositoryFile.findUnique({
      // eslint-disable-next-line camelcase
      where: { gitRepositoryId_agentInstanceId: { gitRepositoryId, agentInstanceId } },
      include: { file: true },
    });
    if (gitRepositoryFile != null) {
      return gitRepositoryFile;
    }

    await db.$executeRawUnsafe(
      `LOCK TABLE "${Prisma.ModelName.GitRepositoryFile}" IN SHARE UPDATE EXCLUSIVE MODE`,
    );

    gitRepositoryFile = await db.gitRepositoryFile.findUnique({
      // eslint-disable-next-line camelcase
      where: { gitRepositoryId_agentInstanceId: { gitRepositoryId, agentInstanceId } },
      include: { file: true },
    });
    if (gitRepositoryFile != null) {
      return gitRepositoryFile;
    }

    const file = await db.file.create({
      data: {
        agentInstanceId,
        path: path.join(HOST_PERSISTENT_DIR, "repositories", `${uuidv4()}.ext4`),
      },
    });
    return await db.gitRepositoryFile.create({
      data: {
        gitRepositoryId,
        fileId: file.id,
        agentInstanceId,
      },
      include: {
        file: true,
      },
    });
  }
}

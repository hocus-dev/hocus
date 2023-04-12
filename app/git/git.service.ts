import type { GitRepository } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";
import type { SshKeyService } from "~/ssh-key/ssh-key.service";
import type { TimeService } from "~/time.service";
import { Token } from "~/token";

import { GitUrlError } from "./error";

export class GitService {
  static inject = [Token.SshKeyService, Token.TimeService] as const;

  constructor(
    private readonly sshKeyService: SshKeyService,
    private readonly timeService: TimeService,
  ) {}

  /**
   * Original source: https://github.com/jonschlinkert/is-git-url/blob/396965ffabf2f46656c8af4c47bef1d69f09292e/index.js#LL9C3-L9C88
   * Modified to disallow the `https` protocol.
   */
  private gitUrlRegex = /(?:git|ssh|git@[-\w.]+):(\/\/)?(.*?)(\.git)(\/?|#[-\d\w._]+?)$/;
  // overwritten in tests
  private maxConnectionErrors = 100;

  isGitSshUrl(url: string): boolean {
    return this.gitUrlRegex.test(url);
  }

  async addGitRepository(
    db: Prisma.TransactionClient,
    repositoryUrl: string,
    sshKeyPairId?: bigint,
  ): Promise<GitRepository> {
    if (!this.isGitSshUrl(repositoryUrl)) {
      throw new GitUrlError(`Invalid git repository URL: ${repositoryUrl}`);
    }
    const keyPair =
      sshKeyPairId != null
        ? await db.sshKeyPair.findUniqueOrThrow({ where: { id: sshKeyPairId } })
        : await this.sshKeyService.generateSshKeyPair(
            db,
            SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
          );
    if (keyPair.type !== SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED) {
      throw new Error(
        `Cannot add git repository with SSH key pair of type ${keyPair.type}. Expected ${SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED}`,
      );
    }

    return await db.gitRepository.create({
      data: {
        url: repositoryUrl,
        sshKeyPairId: keyPair.id,
        GitRepositoryConnectionStatus: {
          create: {},
        },
      },
    });
  }

  async addGitRepositoryIfNotExists(
    db: Prisma.TransactionClient,
    repositoryUrl: string,
    sshKeyPairId?: bigint,
  ): Promise<{ gitRepository: GitRepository; wasCreated: boolean }> {
    const existingRepository = await db.gitRepository.findFirst({
      where: { url: repositoryUrl, sshKeyPairId },
    });
    if (existingRepository != null) {
      return { gitRepository: existingRepository, wasCreated: false };
    }
    await db.$executeRawUnsafe(
      `LOCK TABLE "${Prisma.ModelName.GitRepository}" IN SHARE UPDATE EXCLUSIVE MODE`,
    );
    const existingRepoAfterLock = await db.gitRepository.findFirst({
      where: { url: repositoryUrl, sshKeyPairId },
    });
    if (existingRepoAfterLock != null) {
      return { gitRepository: existingRepoAfterLock, wasCreated: false };
    }
    return {
      gitRepository: await this.addGitRepository(db, repositoryUrl, sshKeyPairId),
      wasCreated: true,
    };
  }

  getGitUsernameFromEmail(email: string): string {
    return email.split("@")[0];
  }

  async updateConnectionStatus(
    db: Prisma.TransactionClient,
    gitRepositoryId: bigint,
    error?: string,
  ): Promise<void> {
    const connectionStatus = await db.gitRepositoryConnectionStatus.findUniqueOrThrow({
      where: { gitRepositoryId },
    });
    await db.$executeRaw`SELECT id FROM "GitRepositoryConnectionStatus" WHERE id = ${connectionStatus.id} FOR UPDATE`;
    const now = this.timeService.now();

    if (error != null) {
      await db.gitRepositoryConnectionError.create({
        data: {
          connectionStatusId: connectionStatus.id,
          error,
          createdAt: now,
        },
      });
      await db.$executeRaw`
        DELETE FROM "GitRepositoryConnectionError" AS x
        WHERE
          x."connectionStatusId" = ${connectionStatus.id} AND
          x."id" NOT IN (
            SELECT t."id"
            FROM "GitRepositoryConnectionError" AS t
            WHERE t."connectionStatusId" = ${connectionStatus.id}
            ORDER BY t."createdAt" DESC
            LIMIT ${this.maxConnectionErrors}
          );
      `;
    } else {
      await db.gitRepositoryConnectionStatus.update({
        where: { gitRepositoryId },
        data: {
          lastSuccessfulConnectionAt: now,
        },
      });
      await db.gitRepositoryConnectionError.deleteMany({
        where: {
          connectionStatusId: connectionStatus.id,
        },
      });
    }
  }

  async getConnectionStatus(
    db: Prisma.Client,
    gitRepositoryId: bigint,
  ): Promise<
    | { status: "connected"; lastConnectedAt: Date }
    | { status: "disconnected"; error?: { message: string; occurredAt: Date } }
  > {
    const connectionStatus = await db.gitRepositoryConnectionStatus.findUniqueOrThrow({
      where: { gitRepositoryId },
      include: {
        errors: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (connectionStatus.errors.length > 0) {
      const error = connectionStatus.errors[0];
      return {
        status: "disconnected",
        error: { message: error.error, occurredAt: error.createdAt },
      };
    }
    const lastConnectedAt = connectionStatus.lastSuccessfulConnectionAt;
    if (lastConnectedAt == null) {
      return { status: "disconnected" };
    }
    return { status: "connected", lastConnectedAt };
  }
}

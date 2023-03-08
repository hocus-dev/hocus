import type { GitRepository } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";
import type { SshKeyService } from "~/ssh-key/ssh-key.service";
import { Token } from "~/token";

import { GitUrlError } from "./error";

export class GitService {
  static inject = [Token.SshKeyService] as const;

  constructor(private readonly sshKeyService: SshKeyService) {}

  /**
   * Original source: https://github.com/jonschlinkert/is-git-url/blob/396965ffabf2f46656c8af4c47bef1d69f09292e/index.js#LL9C3-L9C88
   * Modified to disallow the `https` protocol.
   */
  private gitUrlRegex = /(?:git|ssh|git@[-\w.]+):(\/\/)?(.*?)(\.git)(\/?|#[-\d\w._]+?)$/;

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
}

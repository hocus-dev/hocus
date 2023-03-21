import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { GitService } from "~/git/git.service";
import { Token } from "~/token";

export class UserService {
  static inject = [Token.GitService] as const;
  constructor(private readonly gitService: GitService) {}

  async getOrCreateUser(
    db: Prisma.NonTransactionClient,
    args: {
      externalId: string;
      gitEmail: string;
    },
  ): Promise<User> {
    const { externalId, gitEmail } = args;
    let user = await db.user.findUnique({ where: { externalId } });
    if (user != null) {
      return user;
    }

    return await db.$transaction(async (tdb) => {
      await tdb.$executeRawUnsafe(
        `LOCK TABLE "${Prisma.ModelName.User}" IN SHARE UPDATE EXCLUSIVE MODE`,
      );
      user = await db.user.findUnique({ where: { externalId } });
      if (user != null) {
        return user;
      }

      user = await tdb.user.create({
        data: {
          externalId,
          gitConfig: {
            create: {
              gitEmail,
              gitUsername: this.gitService.getGitUsernameFromEmail(gitEmail),
            },
          },
        },
      });
      return user;
    });
  }
}

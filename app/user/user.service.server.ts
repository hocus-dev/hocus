import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import type { GitService } from "~/git/git.service";
import { HttpError } from "~/http-error.server";
import type { LicenseService } from "~/license/license.service";
import { Token } from "~/token";

export class UserService {
  static inject = [Token.GitService, Token.LicenseService] as const;
  constructor(
    private readonly gitService: GitService,
    private readonly licenseService: LicenseService,
  ) {}

  async getOrCreateUser(
    db: Prisma.NonTransactionClient,
    args: {
      externalId: string;
      gitEmail: string;
      gitName?: string;
    },
  ): Promise<User> {
    const { externalId, gitEmail, gitName } = args;
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
      const activeUsersCount = await db.user.count({
        where: {
          active: true,
        },
      });
      if (activeUsersCount >= this.licenseService.numSeats) {
        throw new HttpError(
          StatusCodes.FORBIDDEN,
          `Too many active users. Please purchase a license with more seats. Current used seats: ${activeUsersCount}/${this.licenseService.numSeats}.`,
        );
      }
      user = await tdb.user.create({
        data: {
          externalId,
          active: true,
          gitConfig: {
            create: {
              gitEmail,
              gitUsername: gitName ?? this.gitService.getGitUsernameFromEmail(gitEmail),
            },
          },
        },
      });
      return user;
    });
  }
}

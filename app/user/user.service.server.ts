import type { User, PrismaClient } from "@prisma/client";

export class UserService {
  async getUser(db: PrismaClient, externalId: string): Promise<User | null> {
    const user = await db.user.findUnique({ where: { externalId } });
    return user;
  }

  async upsertUser(db: PrismaClient, externalId: string): Promise<User> {
    await db.$queryRaw`
      INSERT INTO "User" ("externalId")
      VALUES (${externalId})
      ON CONFLICT DO NOTHING;
    `;
    return await db.user.findUniqueOrThrow({ where: { externalId } });
  }
}

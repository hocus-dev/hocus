import type { SshKeyPair } from "@prisma/client";
import { SshKeyPairType, Prisma } from "@prisma/client";
import sshpk from "sshpk";

export class SshKeyService {
  async generateSshKeyPair(db: Prisma.Client, type: SshKeyPairType): Promise<SshKeyPair> {
    const privateKey = await sshpk.generatePrivateKey("ed25519");
    privateKey.comment = "hocus";
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
    const sshPublicKey = parsedPrivateKey.toPublic().toString("ssh", { comment: "hocus" });

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
}

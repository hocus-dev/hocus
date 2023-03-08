import type { SshKeyPair, UserSSHPublicKey } from "@prisma/client";
import type { SshKeyPairType, Prisma } from "@prisma/client";
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
   * Throws a `sshpk.KeyParseError` if the public key is invalid.
   */
  async createPublicSshKeyForUser(
    db: Prisma.TransactionClient,
    userId: bigint,
    publicKey: string,
    name: string,
  ): Promise<UserSSHPublicKey> {
    const parsedPublicKey = sshpk.parseKey(publicKey, "ssh");
    const publicKeyString = parsedPublicKey.toString("ssh");
    return await db.userSSHPublicKey.create({
      data: { publicKey: publicKeyString, userId, name },
    });
  }
}

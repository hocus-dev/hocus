import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import SshPK from "sshpk";
import { HttpError } from "~/http-error.server";
import { PagePaths } from "~/page-paths.shared";
import { CreateSshKeyValidator } from "~/schema/create-ssh-key.validator.server";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export const action = async ({ context: { db, req, user, app } }: ActionArgs) => {
  const sshKeyService = app.resolve(Token.SshKeyService);
  const formData = req.body;
  const { success, value: sshKeyInfo } = CreateSshKeyValidator.SafeParse(formData);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid form data");
  }

  try {
    await db.$transaction(async (tdb) =>
      sshKeyService.createPublicSshKeyForUser(
        tdb,
        unwrap(user).id,
        sshKeyInfo.publicKey,
        sshKeyInfo.name,
      ),
    );
  } catch (e) {
    if (e instanceof SshPK.KeyParseError) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid public key");
    }
    throw e;
  }

  return redirect(PagePaths.UserSettings);
};

export default function Create() {
  // exists because errors would not be rendered without it
  return null;
}

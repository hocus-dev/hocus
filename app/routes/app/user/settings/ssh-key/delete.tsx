import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "~/http-error.server";
import { PagePaths } from "~/page-paths.shared";
import { DeleteSshKeyValidator } from "~/schema/delete-ssh-key.validator.server";
import { unwrap } from "~/utils.shared";

export const action = async ({ context: { db, req, user } }: ActionArgs) => {
  const formData = req.body;
  const { success, value: sshKeyInfo } = DeleteSshKeyValidator.SafeParse(formData);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid form data");
  }
  await db.$transaction(async (tdb) => {
    const key = await tdb.userSSHPublicKey.findUnique({
      where: {
        externalId: sshKeyInfo.externalId,
      },
    });
    if (key == null) {
      throw new HttpError(StatusCodes.NOT_FOUND, "SSH key not found");
    }
    if (key.userId !== unwrap(user).id) {
      throw new HttpError(StatusCodes.FORBIDDEN, "SSH key does not belong to user");
    }
    await tdb.userSSHPublicKey.delete({
      where: {
        id: key.id,
      },
    });
  });

  return redirect(PagePaths.UserSettings);
};

export default function Delete() {
  // exists because errors would not be rendered without it
  return null;
}

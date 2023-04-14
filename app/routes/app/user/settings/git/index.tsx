import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { Alert, Button, Label, TextInput } from "flowbite-react";
import { StatusCodes } from "http-status-codes";

import { CsrfInput } from "~/components/csrf-input";
import { SettingsPage } from "~/components/settings/settings-page";
import { HttpError } from "~/http-error.server";
import { SettingsPageTab } from "~/page-paths.shared";
import { UpdateGitDetailsValidator } from "~/schema/update-git-details.validator.server";
import { unwrap } from "~/utils.shared";

export const loader = async ({ context: { db, user: contextUser } }: LoaderArgs) => {
  const user = unwrap(contextUser);
  const gitConfig = await db.userGitConfig.findUniqueOrThrow({
    where: {
      id: user.gitConfigId,
    },
  });

  return json({
    gitUsername: gitConfig.gitUsername,
    gitEmail: gitConfig.gitEmail,
  });
};

export const action = async ({ context: { req, db, user: contextUser } }: ActionArgs) => {
  const user = unwrap(contextUser);
  const formData = req.body;
  const { success, value: gitDetails } = UpdateGitDetailsValidator.SafeParse(formData);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid form data");
  }

  await db.$transaction(async (tdb) => {
    await tdb.userGitConfig.update({
      where: {
        id: user.gitConfigId,
      },
      data: { gitUsername: gitDetails.name, gitEmail: gitDetails.email },
    });
  });

  return json({ success: true });
};

export default function Git(): JSX.Element {
  const { gitUsername, gitEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const showAlert = actionData?.success != null;

  return (
    <SettingsPage tab={SettingsPageTab.Git}>
      <h2 className="font-bold text-2xl mb-2">Git</h2>
      <p className="text-gray-400">
        The following details will be used to configure the Git user in your new workspaces.
      </p>
      {showAlert && (
        <Alert color="success" className="mt-8">
          <span>Changes saved successfully.</span>
        </Alert>
      )}
      <div className="mb-8"></div>
      <div className="mt-8">
        <form method="POST">
          <CsrfInput />
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 block">
                <Label htmlFor="key-name" value="Name" />
              </div>
              <TextInput
                name="name"
                id="key-name"
                type="text"
                defaultValue={gitUsername}
                required={true}
              />
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="key-email" value="Email" />
              </div>
              <TextInput
                name="email"
                id="key-email"
                type="text"
                defaultValue={gitEmail}
                required={true}
              />
            </div>
            <div className="flex justify-end mt-2">
              <Button type="submit" color="success" size="sm">
                <i className="fa-solid fa-floppy-disk mr-2"></i>
                <span>Save Changes</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </SettingsPage>
  );
}

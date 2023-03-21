import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Button, Label, Textarea, TextInput } from "flowbite-react";
import { CsrfInput } from "~/components/csrf-input";
import { SettingsPage } from "~/components/settings/settings-page";
import { SshKey } from "~/components/settings/ssh-key";
import { PagePaths, SettingsPageTab } from "~/page-paths.shared";
import { unwrap } from "~/utils.shared";

export const loader = async ({ context: { db, user: contextUser } }: LoaderArgs) => {
  const user = unwrap(contextUser);
  const userPublicKeys = await db.userSSHPublicKey.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return json({
    publicKeys: userPublicKeys.map((k) => ({
      externalId: k.externalId,
      name: k.name,
      publicKey: k.publicKey,
    })),
  });
};

export default function SshKeys(): JSX.Element {
  const { publicKeys } = useLoaderData<typeof loader>();

  return (
    <SettingsPage tab={SettingsPageTab.SshKeys}>
      <h2 className="font-bold text-2xl mb-2">SSH Keys</h2>
      <p className="text-gray-400">These public keys will be added to every workspace you open.</p>
      <div className="mb-8"></div>
      <div className="flex flex-col gap-8">
        {publicKeys.map((key) => (
          <SshKey
            key={key.externalId}
            externalId={key.externalId}
            name={key.name}
            publicKey={key.publicKey}
          />
        ))}
        {publicKeys.length === 0 && (
          <p className="text-gray-400 text-sm">
            <i className="fa-solid fa-circle-info mr-2"></i>
            <span>You don't have any SSH keys added to your account. Add one below.</span>
          </p>
        )}
      </div>
      <div className="mt-8">
        <hr className="border-gray-700 mb-8" />
        <h2 className="font-bold text-xl mb-4">Add SSH Key</h2>
        <form action={PagePaths.UserSettingsSshKeyCreate} method="POST">
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
                placeholder="Work Laptop"
                required={true}
              />
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="public-key" value="Public Key" />
              </div>
              <Textarea
                name="publicKey"
                id="public-key"
                placeholder="ssh-ed25519 AAAAC..."
                required={true}
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end mt-2">
              <Button type="submit" color="success" size="sm">
                <i className="fa-solid fa-floppy-disk mr-2"></i>
                <span>Save Key</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </SettingsPage>
  );
}

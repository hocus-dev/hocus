import type { LoaderArgs } from "@remix-run/node";
import { Button, Label, ListGroup, Textarea, TextInput } from "flowbite-react";
import { AppPage } from "~/components/app-page";
import { SshKey } from "~/components/settings/ssh-key";
import { DEV_USER_SSH_PUBLIC_KEY } from "~/dev/constants";

export const loader = async ({ context: _ }: LoaderArgs) => {
  return null;
};

export default function Settings(): JSX.Element {
  return (
    <AppPage>
      <h1 className="mt-8 mb-4 font-bold text-4xl">Settings</h1>
      <div className="grow grid grid-cols-[12rem_minmax(0,_1fr)]">
        <ListGroup
          style={{ borderTopRightRadius: "0 !important", borderBottomRightRadius: "0 !important" }}
        >
          <ListGroup.Item className="m-4:important" active={true}>
            SSH Keys
          </ListGroup.Item>
        </ListGroup>
        <div className="rounded-r-lg border-r border-y border-gray-700 p-8">
          <h2 className="font-bold text-2xl mb-2">SSH Keys</h2>
          <p className="text-gray-400">
            These public keys will be added to every workspace you open.
          </p>
          <div className="mb-8"></div>
          <div className="flex flex-col gap-8">
            <SshKey name="My Personal Key" publicKey={DEV_USER_SSH_PUBLIC_KEY} />
            <SshKey name="My Personal Key 2" publicKey={DEV_USER_SSH_PUBLIC_KEY} />
            <SshKey name="My Personal Key 3" publicKey={DEV_USER_SSH_PUBLIC_KEY} />
          </div>
          <div className="mt-8">
            <hr className="border-gray-700 mb-8" />
            <h2 className="font-bold text-xl mb-4">Add SSH Key</h2>
            <form>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="key-name" value="Name" />
                  </div>
                  <TextInput id="key-name" type="text" placeholder="Work Laptop" required={true} />
                </div>
                <div>
                  <div className="mb-2 block">
                    <Label htmlFor="public-key" value="Public Key" />
                  </div>
                  <Textarea
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
        </div>
      </div>
    </AppPage>
  );
}

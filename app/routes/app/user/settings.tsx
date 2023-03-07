import type { LoaderArgs } from "@remix-run/node";
import { ListGroup } from "flowbite-react";
import { AppPage } from "~/components/app-page";

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
            SSH keys allow you to connect to your projects without having to enter your password
            every time. You can generate a new key pair or upload an existing one.
          </p>
        </div>
      </div>
    </AppPage>
  );
}

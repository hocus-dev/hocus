import { Button, Card } from "flowbite-react";
import { AppPage } from "~/components/app-page";

export default function WorkspaceCardMockup(): JSX.Element {
  return (
    <AppPage>
      <div className="w-full h-full flex justify-center items-center">
        <Card className="w-[30rem]">
          <div className="h-full w-full flex flex-col items-center">
            <h3 className="text-gray-400 mb-4">Workspace ready</h3>
            <h2 className="font-extrabold text-xl mb-8">Web App/Backend 38</h2>
            <div className="flex place-content-between w-full px-4 mb-2">
              <div className="text-left text-gray-400">Based on branch:</div>
              <div className="text-right font-bold">main</div>
            </div>
            <div className="flex place-content-between w-full mb-8 px-4">
              <div className="text-left text-gray-400">Based on commit:</div>
              <div className="text-right font-bold">
                <p>5b558cc</p>
                <p>"Add the project edit endpoint"</p>
              </div>
            </div>
            <div className="text-gray-400 px-16 mb-8">
              <p>VSCode should open automatically.</p>
              <p>If it doesn't, click the button below.</p>
            </div>
            <Button className="w-56 mb-2" color={"success"}>
              Open VSCode
            </Button>
          </div>
        </Card>
      </div>
    </AppPage>
  );
}

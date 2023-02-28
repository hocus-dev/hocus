import { Card, Spinner } from "flowbite-react";

import { WorkspaceStatusComponent } from "./workspace-status";

export function WorkspaceStatusCardPlaceholder(): JSX.Element {
  return (
    <Card className="w-[28rem] max-w-xl">
      <div>
        <h2 className="text-center text-md text-gray-400 mb-4">
          <WorkspaceStatusComponent status={"WORKSPACE_STATUS_PENDING_CREATE"} />
        </h2>
        <h2 className="text-center text-md text-gray-400 mb-2">Workspace</h2>
        <h1 className="text-center text-xl font-bold">
          <div className="flex justify-center">
            <div className="animate-pulse w-1/2 h-6 bg-gray-600 rounded"></div>
          </div>
        </h1>
        <div className="flex flex-col mt-8 gap-4">
          {[
            [20, 36],
            [36, 28],
            [28, 36],
            [36, 20],
            [20, 36],
          ].map(([lw, rw], idx) => (
            <div key={idx} className="grid grid-cols-2">
              <div className="flex justify-start">
                <div className={`animate-pulse w-${lw} h-4 bg-gray-700 rounded`}></div>
              </div>
              <div className="flex justify-end">
                <div className={`animate-pulse w-${rw} h-4 bg-gray-600 rounded`}></div>
              </div>
            </div>
          ))}
        </div>
        <div className="w-full flex justify-center mt-10">
          <Spinner size="lg" color="warning" />
        </div>
      </div>
    </Card>
  );
}
